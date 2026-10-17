import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queue/constants';

export interface SendDmPayload {
  campaignId: string;
  instagramAccountId: string;
  recipientId: string; // Native Instagram user ID
  recipientUsername: string;
  commentId?: string; // Internal DB Comment.id (optional)
  igCommentId?: string; // Native Meta Instagram comment ID (optional)
  replyMessage: string;
  replyMediaUrl?: string;
  isFollowBypass?: boolean;
  skipPublicReply?: boolean;
  webhookEventId?: string;
  jobId?: string;
}

@Injectable()
export class SendDmProducer {
  constructor(@InjectQueue(QUEUE_NAMES.SEND_DM) private readonly queue: Queue) {}

  async enqueueSendDm(payload: SendDmPayload) {
    let delayMs = 0;
    try {
      const waitingCount = await this.queue.getWaitingCount();
      if (waitingCount > 20) {
        // Adaptive surge pacing: add humanized random jitter delay (2s to 6s) during traffic spikes
        delayMs = Math.floor(Math.random() * 4000) + 2000;
      }
    } catch (e) {
      // ignore queue stat error
    }

    const jobOptions: any = {
      attempts: 3,
      delay: delayMs,
      backoff: { type: 'exponential', delay: 10_000 }, // 10s, 20s, 40s
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1000 },
    };
    if (payload.jobId) {
      jobOptions.jobId = payload.jobId;
    }

    await this.queue.add('send_dm', payload, jobOptions);
    return { queued: true, paced: delayMs > 0 };
  }
}
