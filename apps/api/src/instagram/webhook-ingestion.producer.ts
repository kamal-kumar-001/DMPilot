import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queue/constants';
import { AppLogger } from '../common/logger/logger.service';

export interface WebhookJobPayload {
  entryId?: string;
  body: Record<string, any>;
  receivedAt: number;
}

@Injectable()
export class WebhookIngestionProducer {
  constructor(
    @InjectQueue(QUEUE_NAMES.WEBHOOK_INGESTION) private readonly queue: Queue,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext('WebhookIngestionProducer');
  }

  async enqueueWebhook(payload: WebhookJobPayload): Promise<string> {
    const timeBucket = Math.floor(payload.receivedAt / 1000);
    const mid =
      payload.body?.entry?.[0]?.messaging?.[0]?.message?.mid ||
      payload.body?.entry?.[0]?.changes?.[0]?.value?.id ||
      payload.entryId ||
      'unknown';
    const jobId = `wh_${mid}_${timeBucket}`;

    await this.queue.add('process_meta_webhook', payload, {
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 3000 },
    });

    this.logger.log(`Enqueued webhook job ${jobId} to BullMQ`);
    return jobId;
  }
}
