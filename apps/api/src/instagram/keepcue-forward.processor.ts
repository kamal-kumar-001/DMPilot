/**
 * CANDIDATE — source-only, not deployed, gated OFF by default.
 * Dispatches outboxed DMs to the KeepCue bridge with the exact signed bytes
 * persisted at enqueue time, applying the bridge response contract:
 *   200 -> delete outbox row; 429/network/5xx -> retry (BullMQ backoff);
 *   409/other 4xx -> dead-letter, no retry; 401 -> config error, alert, no retry.
 */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import axios from 'axios';
import { QUEUE_NAMES } from '../queue/constants';
import { OUTBOX_PENDING_MAX_AGE_MS } from './keepcue-forward';
import { PrismaService } from '../prisma/prisma.service';
import {
  GUARD_HOLD_BUDGET_MS,
  GUARD_HOLD_DEFAULT_RETRY_MS,
  keepcueBackoffStrategy,
  mapBridgeResponse,
  readKeepcueForwardConfig,
  signBridgePayload,
} from './keepcue-forward';

interface DispatchJob {
  appId: string;
  recipientIgId: string;
  igsid: string;
  messageId: string;
}

// Custom backoffStrategy: BullMQ's built-in exponential is UNCAPPED (30s ->
// ... -> 32min -> 64min); the documented 30-minute cap only exists when the
// strategy is wired here. The job option's backoff.delay stays the base.
@Processor(QUEUE_NAMES.KEEPCUE_DM_FORWARD, {
  settings: { backoffStrategy: keepcueBackoffStrategy },
})
export class KeepcueForwardProcessor extends WorkerHost {
  private readonly logger = new Logger(KeepcueForwardProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<DispatchJob>): Promise<void> {
    const { appId, recipientIgId, igsid, messageId } = job.data;
    // Absolute lifetime bound FIRST, BEFORE any PG access: expiry must hold
    // even while PG is down (reading PG before the age check would let an
    // outage prevent expiry). anchoredAt is the ORIGINAL handoff instant,
    // carried in the job data so restarts/revivals never reset the clock.
    // Only queue-only anchors carry it; identity-only jobs are bounded by
    // their retry budget and the outbox row's own PG-side age bound.
    const anchoredAtRaw = (job.data as any).anchoredAt;
    if (
      typeof anchoredAtRaw === 'number' &&
      Date.now() - anchoredAtRaw >= OUTBOX_PENDING_MAX_AGE_MS
    ) {
      this.logger.warn(
        `KeepCue forward anchor expired by the 24h absolute bound; dropping ${messageId}`,
      );
      return;
    }
    let row = await this.prisma.dmForwardOutbox.findUnique({
      where: {
        appId_recipientIgId_igsid_messageId: { appId, recipientIgId, igsid, messageId },
      },
    });
    if (!row && typeof (job.data as any).rawBody === 'string' && (job.data as any).rawBody) {
      // Full-outage fallback anchor: the queue job carried the dispatch
      // bytes because PG was unwritable at handoff time. Not expired (the
      // check above ran first), so rehydrate - preserving the ORIGINAL
      // handoff time as createdAt, never the rehydration time.
      const anchoredAt = anchoredAtRaw as number;
      await this.prisma.dmForwardOutbox.createMany({
        data: [
          {
            appId,
            recipientIgId,
            igsid,
            messageId,
            rawBody: (job.data as any).rawBody as string,
            createdAt: new Date(anchoredAt), // original handoff time, not rehydration time
          },
        ],
        skipDuplicates: true,
      });
      row = await this.prisma.dmForwardOutbox.findUnique({
        where: {
          appId_recipientIgId_igsid_messageId: { appId, recipientIgId, igsid, messageId },
        },
      });
    }
    if (!row || row.status !== 'PENDING') return; // already resolved

    const config = readKeepcueForwardConfig();
    if (!config.enabled || !config.secret) {
      await this.mark(row.id, 'CONFIG_ERROR', 'gate off or KEEPCUE_BRIDGE_SECRET missing');
      this.logger.error(
        'KeepCue forward CONFIG_ERROR: gate off or bridge secret missing; alert operator',
      );
      return;
    }

    const timestamp = Date.now();
    const signature = signBridgePayload(
      config.secret,
      timestamp,
      appId,
      recipientIgId,
      igsid,
      messageId,
      row.rawBody,
    );

    let status: number | null = null;
    let skipped: string | null = null;
    let retryAfterMs: number | null = null;
    try {
      const res = await axios.post(config.bridgeUrl, row.rawBody, {
        headers: {
          'content-type': 'application/json',
          'x-bridge-timestamp': String(timestamp),
          'x-bridge-signature': signature,
        },
        transformResponse: [(x) => x], // never re-serialize; rawBody is the signed bytes
        validateStatus: () => true,
        timeout: 15_000,
      });
      status = res.status;
      // FIRST-USE PROPOSAL: read the bridge's machine-readable skip code from
      // the RESPONSE body (the signed REQUEST bytes are untouched). Defensive
      // parse only: an unparseable body leaves skipped null and the pure
      // status mapping applies, identical to the reviewed candidate.
      if (typeof res.data === 'string' && res.data.length > 0 && res.data.length <= 4096) {
        try {
          const parsed = JSON.parse(res.data);
          if (parsed && typeof parsed.skipped === 'string') skipped = parsed.skipped;
          if (parsed && Number.isFinite(parsed.retryAfterMs))
            retryAfterMs = Number(parsed.retryAfterMs);
        } catch {
          /* not JSON: status-only mapping */
        }
      }
    } catch {
      status = null; // network/timeout: transient
    }

    const outcome = status === null ? 'retry' : mapBridgeResponse(status, skipped);
    if (outcome === 'hold') {
      // First-use guard hold: NOT a durable negative. Keep the row PENDING,
      // keep the payload (no redaction), do NOT consume the durable-defect
      // attempt budget, and re-schedule after the bridge-requested delay
      // (clamped). Bounded absolutely by GUARD_HOLD_BUDGET_MS from the row's
      // original anchor: past it, further holds are terminal, so a
      // misbehaving bridge cannot park a row forever. The terminal bridge
      // answer (e.g. before_linking 409) still dead-letters via the normal
      // path below; a future bridge that promotes held claims would resolve
      // this row to done without any re-anchoring.
      const heldMs = Date.now() - new Date(row.createdAt).getTime();
      if (heldMs >= GUARD_HOLD_BUDGET_MS) {
        await this.mark(row.id, 'DEAD', `guard_hold budget exhausted after ${heldMs}ms`, true);
        this.logger.warn(
          `KeepCue forward dead-lettered ${messageId}: first-use hold budget exhausted`,
        );
        return;
      }
      const delayMs = retryAfterMs ?? GUARD_HOLD_DEFAULT_RETRY_MS;
      await this.mark(
        row.id,
        'PENDING',
        `guard_hold: bridge parked claim (first-use wait), retry after ${delayMs}ms`,
        false,
        false,
      );
      throw new Error(`KEEPCUE_HOLD:${delayMs} bridge parked first-use claim for ${messageId}`);
    }
    if (outcome === 'done') {
      await this.prisma.dmForwardOutbox.delete({ where: { id: row.id } });
      return;
    }
    if (outcome === 'dead') {
      // Retention policy: the payload (link codes / reel URLs / sender ids)
      // is redacted AT the terminal transition; the redacted audit row is
      // kept for OUTBOX_DEAD_RETENTION_MS and then hard-deleted by the
      // reconciler. No payload lingers on a durable negative.
      await this.mark(row.id, 'DEAD', `bridge ${status}`, true);
      this.logger.warn(`KeepCue forward dead-lettered ${messageId}: bridge ${status}`);
      return;
    }
    if (outcome === 'config_error') {
      await this.mark(row.id, 'CONFIG_ERROR', 'bridge 401');
      this.logger.error(
        'KeepCue forward CONFIG_ERROR: bridge 401, secret/config mismatch; alert operator',
      );
      return;
    }
    // retry: let BullMQ's backoff schedule the next attempt
    await this.mark(row.id, 'PENDING', `transient (bridge ${status ?? 'network'})`);
    throw new Error(`KeepCue forward transient failure (bridge ${status ?? 'network'})`);
  }

  private async mark(
    id: string,
    status: 'PENDING' | 'DEAD' | 'CONFIG_ERROR',
    lastError: string,
    redactPayload = false,
    countAttempt = true,
  ) {
    await this.prisma.dmForwardOutbox.update({
      where: { id },
      data: {
        status,
        lastError: lastError.slice(0, 500),
        // A guard-hold re-schedule is not a dispatch defect: it must not
        // consume the durable attempt budget (OUTBOX_MAX_DISPATCH_ATTEMPTS)
        // the reconciler enforces.
        ...(countAttempt ? { attempts: { increment: 1 } } : {}),
        ...(redactPayload ? { rawBody: '' } : {}),
      },
    });
  }
}

// The dedicated anchor queue runs the SAME dispatch logic through its own
// worker. Anchors are rawBody carriers (queue-only durability handoffs);
// keeping them on their own queue makes lifetime enforcement independent
// of the main queue's backlog.
@Processor(QUEUE_NAMES.KEEPCUE_DM_FORWARD_ANCHOR, {
  settings: { backoffStrategy: keepcueBackoffStrategy },
})
export class KeepcueForwardAnchorProcessor extends KeepcueForwardProcessor {
  constructor(prisma: PrismaService) {
    super(prisma);
  }
}
