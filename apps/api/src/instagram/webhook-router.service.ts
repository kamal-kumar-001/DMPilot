import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../common/logger/logger.service';
import { CommentAutomationService } from './comment-automation.service';
import { MessageAutomationService } from './message-automation.service';

/**
 * Routes incoming Meta webhook payloads to the appropriate automation handler.
 * This is called asynchronously after the webhook event is saved to DB —
 * the HTTP 200 is already returned before this runs.
 */
@Injectable()
export class WebhookRouterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    private readonly commentAutomation: CommentAutomationService,
    private readonly messageAutomation: MessageAutomationService,
  ) {
    this.logger.setContext('WebhookRouterService');
  }

  async route(webhookEventId: string, payload: Record<string, any>): Promise<void> {
    try {
      const entries: any[] = payload?.entry ?? [];

      for (const entry of entries) {
        const instagramId: string = entry?.id;

        // --- Comment & Message changes ---
        const changes: any[] = entry?.changes ?? [];
        for (const change of changes) {
          if (change?.field === 'comments') {
            await this.handleCommentChange(instagramId, change.value, webhookEventId);
          } else if (change?.field === 'messages') {
            await this.handleMessageChange(instagramId, change.value, webhookEventId);
          }
        }

        // --- Messaging ---
        const messaging: any[] = entry?.messaging ?? [];
        for (const message of messaging) {
          if (message?.message) {
            await this.handleMessageEvent(instagramId, message, webhookEventId);
          }
        }
      }

      // --- Handle Meta Dashboard Test Events ("sample" object) ---
      if (payload?.sample?.field) {
        const sampleField = payload.sample.field;
        const sampleValue = payload.sample.value;
        const testIgId =
          sampleValue?.from?.self_ig_scoped_id || sampleValue?.from?.id || '232323232';
        this.logger.log(`Processing Meta sample test event for field: ${sampleField}`);
        if (sampleField === 'comments') {
          await this.handleCommentChange(testIgId, sampleValue, webhookEventId);
        } else if (sampleField === 'messages') {
          await this.handleMessageChange(testIgId, sampleValue, webhookEventId);
        }
      }

      // --- Handle direct field/value format ---
      if (payload?.field && payload?.value) {
        const directField = payload.field;
        const directValue = payload.value;
        const testIgId =
          directValue?.from?.self_ig_scoped_id || directValue?.from?.id || '232323232';
        this.logger.log(`Processing direct event for field: ${directField}`);
        if (directField === 'comments') {
          await this.handleCommentChange(testIgId, directValue, webhookEventId);
        } else if (directField === 'messages') {
          await this.handleMessageChange(testIgId, directValue, webhookEventId);
        }
      }

      await this.prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: { status: 'PROCESSED' },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`WebhookRouter failed for event ${webhookEventId}: ${msg}`);
      await this.prisma.webhookEvent
        .update({
          where: { id: webhookEventId },
          data: { status: 'FAILED', errorMessage: msg },
        })
        .catch(() => null);
    }
  }

  private async handleCommentChange(
    instagramId: string,
    value: Record<string, any>,
    webhookEventId: string,
  ) {
    const commentId: string = value?.id;
    const mediaId: string = value?.media?.id;
    const text: string = value?.text ?? '';
    const fromId: string = value?.from?.id;
    const fromUsername: string = value?.from?.username ?? '';

    if (!commentId || !mediaId || !fromId) {
      this.logger.warn(
        `Skipping comment event — missing fields. commentId=${commentId} mediaId=${mediaId} fromId=${fromId}`,
      );
      return;
    }

    this.logger.log(
      `Routing comment event: commentId=${commentId} mediaId=${mediaId} from=${fromUsername}`,
    );

    await this.commentAutomation.handle({
      instagramId,
      commentId,
      mediaId,
      text,
      fromId,
      fromUsername,
      webhookEventId,
    });
  }

  private extractSharedMedia(messageObj: Record<string, any>) {
    if (!messageObj) return undefined;

    // 1. Check attachments (ig_reel, share, ig_post, video)
    const attachments = messageObj.attachments;
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        const type = (att?.type || '').toLowerCase();
        const payload = att?.payload || {};
        const url = payload.url || payload.media_url || payload.target_url;
        const mediaId = payload.video_id || payload.id || payload.media_id;
        const title = payload.title || payload.caption;

        if (type === 'ig_reel' || type === 'reel') {
          const shortcode = url ? this.extractShortcode(url) : undefined;
          return { type: 'reel' as const, url, shortcode, mediaId, title };
        }

        if (type === 'share' || type === 'ig_post' || type === 'post') {
          const isReel = url && url.includes('/reel/');
          const shortcode = url ? this.extractShortcode(url) : undefined;
          return {
            type: (isReel ? 'reel' : 'post') as 'reel' | 'post',
            url,
            shortcode,
            mediaId,
            title,
          };
        }

        if (type === 'video' || type === 'image') {
          if (url && (url.includes('/reel/') || url.includes('/p/'))) {
            const shortcode = this.extractShortcode(url);
            const isReel = url.includes('/reel/');
            return {
              type: (isReel ? 'reel' : 'post') as 'reel' | 'post',
              url,
              shortcode,
              mediaId,
              title,
            };
          }
        }
      }
    }

    // 2. Check direct share object (message.share)
    if (messageObj.share) {
      const link = messageObj.share.link;
      const mediaId = messageObj.share.id;
      if (link) {
        const isReel = link.includes('/reel/');
        const shortcode = this.extractShortcode(link);
        return {
          type: (isReel ? 'reel' : 'post') as 'reel' | 'post',
          url: link,
          shortcode,
          mediaId,
        };
      }
    }

    return undefined;
  }

  private extractShortcode(url: string): string | undefined {
    const match = url.match(/(?:reel|p)\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : undefined;
  }

  private async handleMessageEvent(
    instagramId: string,
    messagingEvent: Record<string, any>,
    webhookEventId: string,
  ) {
    const messageId: string = messagingEvent?.message?.mid;
    const text: string = messagingEvent?.message?.text ?? '';
    const fromId: string = messagingEvent?.sender?.id;
    const quickReplyPayload: string | undefined = messagingEvent?.message?.quick_reply?.payload;
    const attachments: any[] = messagingEvent?.message?.attachments ?? [];
    const sharedMedia = this.extractSharedMedia(messagingEvent?.message);

    if (!messageId || !fromId) {
      this.logger.warn(`Skipping messaging event — missing messageId or fromId.`);
      return;
    }

    this.logger.log(
      `Routing messaging event: messageId=${messageId} shared=${sharedMedia ? sharedMedia.type : 'none'}`,
    );

    const isStoryReply = !!messagingEvent?.message?.reply_to?.story;

    await this.messageAutomation.handle({
      instagramId,
      messageId,
      text,
      fromId,
      isStoryReply,
      quickReplyPayload,
      sharedMedia,
      attachments,
      webhookEventId,
    });
  }

  private async handleMessageChange(
    instagramId: string,
    value: Record<string, any>,
    webhookEventId: string,
  ) {
    const messageId: string = value?.message?.mid;
    const text: string = value?.message?.text ?? '';
    const fromId: string = value?.sender?.id;
    const quickReplyPayload: string | undefined = value?.message?.quick_reply?.payload;
    const attachments: any[] = value?.message?.attachments ?? [];
    const sharedMedia = this.extractSharedMedia(value?.message);

    if (!messageId || !fromId) {
      this.logger.warn(`Skipping messaging event changes — missing messageId or fromId.`);
      return;
    }

    this.logger.log(
      `Routing messaging change event: messageId=${messageId} shared=${sharedMedia ? sharedMedia.type : 'none'}`,
    );

    const isStoryReply = !!value?.message?.reply_to?.story;

    await this.messageAutomation.handle({
      instagramId,
      messageId,
      text,
      fromId,
      isStoryReply,
      quickReplyPayload,
      sharedMedia,
      attachments,
      webhookEventId,
    });
  }
}
