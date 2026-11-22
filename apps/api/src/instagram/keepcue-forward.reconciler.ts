/**
 * CANDIDATE — source-only, not deployed, gated OFF by default.
 *
 * Durable reconciliation for the KeepCue forward outbox. Closes the gaps a
 * fire-and-forget enqueue cannot: queue outage after the outbox commit,
 * process crash between commit and enqueue, deploys/restarts, exhausted
 * BullMQ attempts, and terminal-row retention.
 *
 * Every tick (gated on the forward being enabled):
 *   1. PENDING rows with no live job are re-enqueued (idempotent job ids);
 *      a failed job is retried in place.
 *   2. CONFIG_ERROR rows are retried the same way: the cause (gate/secret)
 *      is operator-fixable, and the processor re-checks config per dispatch.
 *   3. Rows past OUTBOX_MAX_DISPATCH_ATTEMPTS, or unresolved for longer
 *      than OUTBOX_PENDING_MAX_AGE_MS (24h), are marked DEAD with their
 *      payload redacted - this bounds raw-payload lifetime even while the
 *      feature is gated off (retention runs regardless of the gate).
 *   4. DEAD rows older than OUTBOX_DEAD_RETENTION_MS (7 days) are hard
 *      deleted. Retention is this outbox's own audit trail only; KeepCue's
 *      history retention is a separate product decision.
 */
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  FORWARD_PERSIST_MARKER,
  KeepcueForwardPersistError,
  OUTBOX_DEAD_RETENTION_MS,
  OUTBOX_MAX_DISPATCH_ATTEMPTS,
  OUTBOX_PENDING_MAX_AGE_MS,
  WEBHOOK_FORWARD_RECOVERY_WINDOW_MS,
  WEBHOOK_STUCK_PENDING_MS,
  extractForwardableMessages,
  readKeepcueForwardConfig,
  FORWARD_SAFE_RECOVERY_OUTCOMES,
} from './keepcue-forward';
import { KeepcueForwardProducer } from './keepcue-forward.producer';
import { KeepcueForwardService } from './keepcue-forward.service';

const RECONCILE_INTERVAL_MS = 30_000;

@Injectable()
export class KeepcueForwardReconciler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KeepcueForwardReconciler.name);
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: KeepcueForwardProducer,
    private readonly forwardService: KeepcueForwardService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), RECONCILE_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      // Retention runs even while the feature is GATED OFF: an undispatched
      // payload must not linger indefinitely just because forwarding is
      // disabled. Requeueing (queue access) happens only when enabled.
      let retention = { retired: 0, purged: 0 };
      let rq = { requeued: 0 };
      let rec = { recovered: 0, checkpointed: 0 };
      try {
        retention = await this.retentionSweep();
        if (readKeepcueForwardConfig().enabled) {
          rq = await this.requeueStranded();
          rec = await this.recoverForwardsFromWebhookEvents();
        }
      } catch (pgErr) {
        // PG-side sweeps fail while PG is down - exactly when queue-only
        // anchors exist. They must NOT abort the queue-side maintenance below.
        this.logger.warn(
          `KeepCue forward reconcile: PG-side sweeps failed (${(pgErr as Error).message}); continuing queue-side anchor maintenance`,
        );
      }
      // Anchor-queue maintenance runs ALWAYS: lifetime expiry is independent
      // of the feature gate, PG availability, job state and main-queue
      // backlog. Revival (re-adding live failed anchors) only while the
      // gate is on.
      let anchors = { purged: 0, revived: 0 };
      try {
        anchors = await this.producer.maintainAnchorQueue({
          revive: readKeepcueForwardConfig().enabled,
        });
      } catch (qErr) {
        this.logger.warn(
          `KeepCue forward reconcile: anchor-queue maintenance failed (${(qErr as Error).message})`,
        );
      }
      if (
        rq.requeued ||
        retention.retired ||
        retention.purged ||
        rec.recovered ||
        rec.checkpointed ||
        anchors.revived ||
        anchors.purged
      ) {
        this.logger.log(
          `KeepCue forward reconcile: requeued=${rq.requeued} retired=${retention.retired} purged=${retention.purged} recovered=${rec.recovered} checkpointed=${rec.checkpointed} queueAnchorsRevived=${anchors.revived} queueAnchorsPurged=${anchors.purged}`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `KeepCue forward reconcile failed (next tick retries): ${(err as Error).message}`,
      );
    } finally {
      this.busy = false;
    }
  }

  /** Gate-on path: make sure every unresolved row has a live job. */
  async requeueStranded(): Promise<{ requeued: number }> {
    let requeued = 0;
    const stranded = await this.prisma.dmForwardOutbox.findMany({
      where: { status: { in: ['PENDING', 'CONFIG_ERROR'] } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    for (const row of stranded) {
      if (row.status === 'CONFIG_ERROR') {
        await this.prisma.dmForwardOutbox.update({
          where: { id: row.id },
          data: { status: 'PENDING' },
        });
      }
      await this.producer.ensureQueued({
        appId: row.appId,
        recipientIgId: row.recipientIgId,
        igsid: row.igsid,
        messageId: row.messageId,
      });
      requeued++;
    }
    return { requeued };
  }

  /**
   * Always-on retention, including while gated off:
   *  - rows past OUTBOX_MAX_DISPATCH_ATTEMPTS -> DEAD, payload redacted;
   *  - PENDING/CONFIG_ERROR rows older than OUTBOX_PENDING_MAX_AGE_MS (24h)
   *    -> DEAD, payload redacted (bounded payload lifetime);
   *  - DEAD rows older than OUTBOX_DEAD_RETENTION_MS (7d) -> hard delete.
   */
  async retentionSweep(): Promise<{ retired: number; purged: number }> {
    const now = Date.now();
    let retired = 0;
    const stale = await this.prisma.dmForwardOutbox.findMany({
      where: { status: { in: ['PENDING', 'CONFIG_ERROR'] } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    for (const row of stale) {
      const overBudget = row.attempts >= OUTBOX_MAX_DISPATCH_ATTEMPTS;
      const tooOld = row.createdAt.getTime() < now - OUTBOX_PENDING_MAX_AGE_MS;
      if (!overBudget && !tooOld) continue;
      await this.prisma.dmForwardOutbox.update({
        where: { id: row.id },
        data: {
          status: 'DEAD',
          lastError: overBudget
            ? 'dispatch attempt budget exhausted'
            : 'dispatch window expired (24h undispatched)',
          rawBody: '',
        },
      });
      retired++;
    }
    const purgedRows = await this.prisma.dmForwardOutbox.deleteMany({
      where: { status: 'DEAD', updatedAt: { lt: new Date(now - OUTBOX_DEAD_RETENTION_MS) } },
    });
    return { retired, purged: purgedRows.count };
  }

  /**
   * Durable forward recovery, gate-ON only. The webhook pipeline's own
   * anchor is the durable WebhookEvent row (full payload). Two owed-forward
   * shapes are re-driven FORWARD-ONLY (automation is never re-run, so the
   * retry boundary can never duplicate unrelated automation actions):
   *   1. rows with forwardPersistFailed (a structural column, NOT the
   *      truncatable errorMessage text): the outbox insert failed
   *      transiently while PG was otherwise up;
   *   2. rows stuck PENDING past WEBHOOK_STUCK_PENDING_MS: routing never
   *      completed (e.g. a PG outage mid-route swallowed both the outbox
   *      insert and the FAILED update).
   * Every cleanly processed row is CHECKPOINTED (forwardRecoveredAt) once
   * its messages re-drive without a persist failure, so recovered rows
   * leave the candidate set. A row whose store still fails is NOT
   * checkpointed; instead its forwardRecoveryAttemptAt is stamped, and
   * candidates are processed least-recently-attempted first (never-
   * attempted rows first). Persistently failing rows therefore rotate to
   * the back of the queue and can never monopolize a pass while later
   * healthy rows wait - fairness holds under persistent failure, not only
   * after successful checkpoints. maybeForward is idempotent
   * (skipDuplicates + enqueue only when newly created), so re-driving a
   * healed row is a no-op. The scan is bounded to the recovery window and
   * a 1000-row page; at most 200 rows are attempted per pass.
   */
  async recoverForwardsFromWebhookEvents(): Promise<{ recovered: number; checkpointed: number }> {
    const since = new Date(Date.now() - WEBHOOK_FORWARD_RECOVERY_WINDOW_MS);
    const stuckBefore = new Date(Date.now() - WEBHOOK_STUCK_PENDING_MS);
    const candidates = await this.prisma.webhookEvent.findMany({
      where: {
        createdAt: { gte: since },
        forwardRecoveredAt: null,
        OR: [
          { forwardPersistFailed: true },
          { errorMessage: { contains: FORWARD_PERSIST_MARKER } }, // pre-column rows
          { status: 'PENDING', createdAt: { lt: stuckBefore } },
        ],
      },
      orderBy: [
        { forwardRecoveryAttemptAt: { sort: 'asc', nulls: 'first' } },
        { createdAt: 'asc' },
      ],
      take: 1000,
    });
    // Store-independent fairness net: even if the store cannot apply the
    // ordering, attempt the least-recently-attempted rows first.
    candidates.sort(
      (a, b) =>
        (a.forwardRecoveryAttemptAt?.getTime() ?? 0) -
          (b.forwardRecoveryAttemptAt?.getTime() ?? 0) ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
    let recovered = 0;
    let checkpointed = 0;
    let attempted = 0;
    for (const ev of candidates) {
      if (attempted >= 200) break;
      attempted++;
      let persistFailed = false;
      const msgs = extractForwardableMessages(ev.payload);
      // No false checkpoint: a row flagged as owing a forward (structural
      // flag or legacy marker) that yields ZERO extractable messages is NOT
      // resolved - extraction and live routing share one mapping, so this
      // means the payload is genuinely unrecoverable; keep it loud.
      if (
        msgs.length === 0 &&
        (ev.forwardPersistFailed || (ev.errorMessage ?? '').includes(FORWARD_PERSIST_MARKER))
      ) {
        persistFailed = true;
      }
      for (const msg of msgs) {
        try {
          const outcome = await this.forwardService.maybeForward(msg);
          if (!FORWARD_SAFE_RECOVERY_OUTCOMES.has(outcome)) {
            // Gate/config/recipient skip: the owed forward is UNRESOLVED,
            // not absent. Do not checkpoint; retry after the cause heals.
            persistFailed = true;
          } else if (outcome === 'persisted') {
            recovered++;
          }
        } catch (err) {
          if (err instanceof KeepcueForwardPersistError) {
            persistFailed = true; // store still failing: rotate to the back
          } else {
            throw err;
          }
        }
      }
      if (!persistFailed) {
        await this.prisma.webhookEvent.update({
          where: { id: ev.id },
          data: { forwardRecoveredAt: new Date() },
        });
        checkpointed++;
      } else {
        await this.prisma.webhookEvent.update({
          where: { id: ev.id },
          data: { forwardRecoveryAttemptAt: new Date() },
        });
      }
    }
    return { recovered, checkpointed };
  }

  /** Back-compat combo (tests): retention + requeue + forward recovery. */
  async reconcileOnce(): Promise<{
    requeued: number;
    retired: number;
    purged: number;
    recovered: number;
    checkpointed: number;
  }> {
    const retention = await this.retentionSweep();
    const rq = await this.requeueStranded();
    const rec = await this.recoverForwardsFromWebhookEvents();
    return {
      requeued: rq.requeued,
      retired: retention.retired,
      purged: retention.purged,
      recovered: rec.recovered,
      checkpointed: rec.checkpointed,
    };
  }
}
