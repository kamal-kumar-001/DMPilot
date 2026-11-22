/**
 * CANDIDATE — source-only, not deployed, gated OFF by default.
 */
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queue/constants';
import { forwardJobId, OUTBOX_PENDING_MAX_AGE_MS } from './keepcue-forward';

@Injectable()
export class KeepcueForwardProducer {
  constructor(
    @InjectQueue(QUEUE_NAMES.KEEPCUE_DM_FORWARD) private readonly queue: Queue,
    @InjectQueue(QUEUE_NAMES.KEEPCUE_DM_FORWARD_ANCHOR) private readonly anchorQueue: Queue,
  ) {}

  /**
   * jobId = hash of the composite event identity (no ':', which BullMQ
   * reserves): BullMQ dedupes redeliveries to the same job. Idempotent.
   */
  async enqueueDispatch(
    appId: string,
    recipientIgId: string,
    igsid: string,
    messageId: string,
  ): Promise<void> {
    await this.queue.add(
      'dispatch',
      { appId, recipientIgId, igsid, messageId },
      {
        jobId: forwardJobId({ appId, recipientIgId, igsid, messageId }),
        attempts: 9, // capped exponential ladder 30s->30min via the Worker's
        // custom backoffStrategy (~2h budget); built-in exponential is
        // uncapped and is NOT what enforces the cap.
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: true,
        removeOnFail: false, // failed job retained so the reconciler can retry it
      },
    );
  }

  /**
   * Durable reconciliation entry point (used by the reconciler after a queue
   * outage/crash/restart): make sure the outbox row HAS a live job with a
   * FULL retry budget. Installed BullMQ preserves attemptsMade across
   * job.retry() (probe: attemptsMade stays 9, so a retried exhausted job
   * gets a single dispatch per cycle) - a failed job is therefore REMOVED
   * and RE-ADDED fresh (attemptsMade resets, same deterministic jobId).
   * A waiting/active/delayed job is left alone.
   */
  /**
   * Deterministic jobId enqueue WITHOUT retry options: used for the
   * ingestion-exhaustion recovery anchor. Retrying the anchored job is the
   * reconciler's job (it re-enqueues PENDING rows); the anchor itself only
   * needs one durable job that dispatches when the queue is healthy.
   */
  async anchorEnqueue(
    anchor: {
      appId: string;
      recipientIgId: string;
      igsid: string;
      messageId: string;
      rawBody?: string;
    },
    opts: { includeRawBody?: boolean } = {},
  ): Promise<void> {
    // Redis is NOT the dispatch-bytes store: the PG outbox row owns rawBody
    // and the processor rehydrates the row from job data only when the
    // outage fallback had to put it there. Job data therefore carries the
    // identity fields only, unless the PG write failed (full-outage
    // fallback), in which case rawBody rides along so the queue ALONE is a
    // durable handoff. Retention is explicit and bounded either way:
    // completed jobs are removed at once; failed jobs are capped (the
    // outbox row survives and ensureQueued re-creates a missing job).
    const { rawBody, ...identity } = anchor;
    const anchoredAt = Date.now();
    const optsOut = {
      jobId: forwardJobId(identity),
      // Same capped 9-attempt ladder as a standard forward job: a queue-only
      // anchor's FIRST execution can still land while PG is down (the
      // rehydrating findUnique throws), and without a retry budget that
      // single failure would strand the handoff in the failed set.
      attempts: 9,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: true,
      // Retention is established by the ABSOLUTE AGE BOUND enforced in
      // maintainAnchorQueue (same 24h bound as the PG outbox), NOT by
      // a failed-job count cap: a count cap can evict the sole copy of a
      // queue-only anchor behind an unrelated failure flood.
      removeOnFail: false,
    };
    if (opts.includeRawBody && rawBody) {
      // Queue-only (full PG outage) anchors go to the DEDICATED anchor queue:
      // its job set contains anchors ONLY, so lifetime enforcement scans it
      // completely every sweep - independent of the main queue's backlog
      // (no fixed page prefix that an unrelated failure flood could hide an
      // anchor behind) and of any per-instance cursor state.
      await this.anchorQueue.add('dispatch', { ...identity, rawBody, anchoredAt }, optsOut);
    } else {
      await this.queue.add('dispatch', identity, optsOut);
    }
  }

  /**
   * Anchor-queue maintenance. Lifetime enforcement runs ALWAYS - independent
   * of the feature gate, PG availability, job state, and main-queue backlog:
   * any anchor at/past OUTBOX_PENDING_MAX_AGE_MS (measured from anchoredAt,
   * which travels with the job, so restarts/revivals never reset the clock)
   * is removed from FAILED, WAITING, DELAYED and PRIORITIZED states. ACTIVE
   * jobs are never removed (force-removing a running job is an unsafe race;
   * the processor applies the same age bound at execution instead).
   * Revival (fresh 9-attempt budget, add-before-remove) only when revive is
   * allowed (gate on). The scan pages until the anchor queue is exhausted -
   * no page cap: this queue holds anchors only, so the scan is complete and
   * fair by construction on every sweep.
   */
  async maintainAnchorQueue(
    opts: { revive: boolean },
    now = Date.now(),
  ): Promise<{ purged: number; revived: number }> {
    let purged = 0;
    let revived = 0;
    for (const state of ['failed', 'waiting', 'delayed', 'prioritized'] as const) {
      for (let start = 0; ; start += 100) {
        // When revivals remove jobs the set shrinks under the cursor; restart
        // the failed scan from 0 after any removal batch (anchor-only set:
        // bounded and converges).
        const jobs = await this.anchorQueue.getJobs([state], start, start + 99);
        if (jobs.length === 0) break;
        let removedAny = false;
        for (const job of jobs) {
          const data = job.data as any;
          if (typeof data?.rawBody !== 'string' || !data.rawBody) continue; // safety net: anchors only
          const anchoredAt =
            typeof data.anchoredAt === 'number' ? data.anchoredAt : (job.timestamp ?? now);
          if (now - anchoredAt >= OUTBOX_PENDING_MAX_AGE_MS) {
            await job.remove(); // expired by the shared absolute bound
            purged++;
            removedAny = true;
            continue;
          }
          if (state !== 'failed' || !opts.revive) continue;
          const reviveCount = (typeof data.reviveCount === 'number' ? data.reviveCount : 0) + 1;
          // ADD the replacement BEFORE removing the old job: remove-then-add
          // could lose the sole payload copy to a failed add or a restart in
          // between; a rare duplicate dispatch is idempotent downstream
          // (outbox skipDuplicates + bridge composite dedupe).
          await this.anchorQueue.add(
            'dispatch',
            { ...data, reviveCount, anchoredAt },
            {
              jobId: `${forwardJobId(data)}-r${reviveCount}`,
              attempts: 9,
              backoff: { type: 'exponential', delay: 30_000 },
              removeOnComplete: true,
              removeOnFail: false,
            },
          );
          await job.remove();
          revived++;
          removedAny = true;
        }
        if (removedAny)
          start = -100; // rescan from the beginning of this state
        else if (jobs.length < 100) break;
      }
    }
    return { purged, revived };
  }

  async ensureQueued(parts: {
    appId: string;
    recipientIgId: string;
    igsid: string;
    messageId: string;
  }): Promise<void> {
    const id = forwardJobId(parts);
    const existing = await this.queue.getJob(id);
    if (existing) {
      const state = await existing.getState();
      if (state === 'failed') {
        await existing.remove(); // fresh cycle: attemptsMade resets to 0
      } else {
        return; // waiting/active/delayed/completed: nothing to do
      }
    }
    await this.enqueueDispatch(parts.appId, parts.recipientIgId, parts.igsid, parts.messageId);
  }
}
