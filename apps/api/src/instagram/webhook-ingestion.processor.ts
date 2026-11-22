import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/constants';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookRouterService } from './webhook-router.service';
import { WebhookJobPayload } from './webhook-ingestion.producer';
// CANDIDATE addition (DM-scoped durable ingress boundary):
import {
  payloadContainsForwardableDm,
  readKeepcueForwardConfig,
  ingressAnchorJobPayloads,
} from './keepcue-forward';
import { KeepcueForwardProducer } from './keepcue-forward.producer';

@Processor(QUEUE_NAMES.WEBHOOK_INGESTION)
export class WebhookIngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookIngestionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookRouter: WebhookRouterService,
    private readonly forwardProducer: KeepcueForwardProducer,
  ) {
    super();
  }

  async process(job: Job<WebhookJobPayload>): Promise<void> {
    const { entryId, body } = job.data;
    this.logger.log(`[Job ${job.id}] Processing queued webhook for entry: ${entryId || 'unknown'}`);

    // 1. Audit log in DB asynchronously
    let savedEventId: string | null = null;
    try {
      const saved = await this.prisma.webhookEvent.create({
        data: {
          eventId: entryId ? `${entryId}_${Date.now()}` : undefined,
          payload: body,
          status: 'PENDING',
        },
      });
      savedEventId = saved.id;
    } catch (dbErr: any) {
      this.logger.error(
        `[Job ${job.id}] Failed to persist WebhookEvent to database: ${dbErr?.message}`,
      );
      // CANDIDATE (DM-scoped durable ingress boundary): with the KeepCue
      // forwarder gate ON and a FORWARDABLE DM payload addressed to a
      // configured KeepCue recipient, continuing without the durable
      // WebhookEvent anchor means every downstream write (outbox insert,
      // failure marker) also fails and the BullMQ job still resolves
      // successfully - the event is lost with no retry and no anchor.
      // Throw so BullMQ retries the job once the store heals. Everything
      // else - non-DM payloads, DMs for other business accounts, DMs
      // without forwardable content, gate-OFF - keeps the baseline
      // temporary-id fallback.
      const fwd = readKeepcueForwardConfig();
      if (fwd.enabled && payloadContainsForwardableDm(body, fwd.recipientIgIds)) {
        // Bounded DM-specific durable recovery: BullMQ retries this job
        // (3 attempts, 2s exponential). On the FINAL attempt, leave a
        // deterministic recovery anchor the reconciler can discover before
        // rethrowing: a PENDING outbox row with the exact dispatch bytes
        // plus a live forward-queue job. After exhaustion the forward
        // pipeline (with its own 9-attempt capped ladder + reconciler)
        // carries the event, so it is never left without a durable anchor.
        const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
        if (isFinalAttempt && fwd.bridgeUrl && fwd.appId) {
          // Hand off EVERY eligible DM in the batch; attempt PG outbox and
          // the forward queue INDEPENDENTLY so a full PG outage still
          // leaves a queue anchor (with the dispatch bytes, rehydrated into
          // the outbox by the forward processor once PG heals) and a queue
          // outage still leaves the PG rows. When at least one store has a
          // durable anchor for every message the DM events are recoverable
          // and processing CONTINUES so mixed-payload siblings keep their
          // baseline recoverability. Only with BOTH stores down does it
          // rethrow - the failed ingestion job itself is retained (bounded:
          // removeOnFail 3000) as the last-ditch record, the stated floor.
          const anchors = ingressAnchorJobPayloads(body, fwd);
          let outboxOk = false;
          try {
            await this.prisma.dmForwardOutbox.createMany({
              data: anchors,
              skipDuplicates: true,
            });
            outboxOk = true;
          } catch (outboxErr: any) {
            this.logger.error(
              `[Job ${job.id}] Recovery-anchor outbox write failed: ${outboxErr?.message}`,
            );
          }
          let queueOk = true;
          for (const anchor of anchors) {
            try {
              await this.forwardProducer.anchorEnqueue(anchor, { includeRawBody: !outboxOk });
            } catch (queueErr: any) {
              queueOk = false;
              this.logger.error(
                `[Job ${job.id}] Recovery-anchor enqueue failed for message ${anchor.messageId}: ${queueErr?.message}`,
              );
            }
          }
          if (outboxOk || queueOk) {
            this.logger.warn(
              `[Job ${job.id}] Ingestion attempts exhausted; ${anchors.length} DM event(s) handed off to the KeepCue forward recovery anchor (outbox=${outboxOk ? 'ok' : 'failed'}, queue=${queueOk ? 'ok' : 'failed'}); rethrowing so the retained failed job keeps the FULL payload recoverable`,
            );
            // The handoff covers ONLY the DM events. With the durable
            // WebhookEvent record missing, a mixed payload's comment/change
            // siblings cannot be proven complete (the baseline router
            // swallows per-handler failures and the temp-row status update
            // fails too - a route() return is not proof). Rethrow so the
            // failed ingestion job, retained bounded (removeOnFail 3000),
            // keeps the entire original payload as the recovery record.
          } else {
            this.logger.error(
              `[Job ${job.id}] Recovery anchor impossible: PG outbox AND forward queue both unavailable`,
            );
          }
          throw dbErr;
        }
        throw dbErr; // non-final attempt or misconfigured forwarder: BullMQ retries
      }
      // Continue execution so the creator's automation is not dropped due to logging failure
    }

    // 2. Check if admin paused webhooks
    try {
      const pausedSetting = await this.prisma.systemSetting.findUnique({
        where: { key: 'webhook_processing_paused' },
      });
      if (pausedSetting?.value === 'true') {
        if (savedEventId) {
          await this.prisma.webhookEvent
            .update({
              where: { id: savedEventId },
              data: {
                status: 'PAUSED',
                errorMessage: 'Webhook processing is paused by admin.',
              },
            })
            .catch(() => null);
        }
        this.logger.warn(`[Job ${job.id}] Webhook processing paused by admin. Skipping.`);
        return;
      }
    } catch {
      // Ignore setting lookup failure
    }

    // 3. Route to automations (CommentAutomationService / MessageAutomationService)
    if (savedEventId) {
      await this.webhookRouter.route(savedEventId, body);
    } else {
      // Fallback: If DB logging failed, route with temporary id to avoid dropping creator DMs
      const fallbackId = `temp_${Date.now()}`;
      await this.webhookRouter.route(fallbackId, body);
    }
  }
}
