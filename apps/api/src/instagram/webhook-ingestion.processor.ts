import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../queue/constants';
import { PrismaService } from '../prisma/prisma.service';
import { WebhookRouterService } from './webhook-router.service';
import { WebhookJobPayload } from './webhook-ingestion.producer';

@Processor(QUEUE_NAMES.WEBHOOK_INGESTION)
export class WebhookIngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookIngestionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookRouter: WebhookRouterService,
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
