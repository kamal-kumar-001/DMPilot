import { NotificationModule } from '../notification/notification.module';
import { Module } from '@nestjs/common';
import { InstagramController } from './instagram.controller';
import { InstagramService } from './instagram.service';
import { WebhookController } from './webhook.controller';
import { AuditLogService } from '../auth/audit-log.service';
import { MediaFetchProducer } from './media-fetch.producer';
import { MediaFetchProcessor } from './media-fetch.processor';
import { InstagramCacheService } from './instagram-cache.service';
import { WebhookRouterService } from './webhook-router.service';
import { CommentAutomationService } from './comment-automation.service';
import { MessageAutomationService } from './message-automation.service';
import { SendDmProducer } from './send-dm.producer';
import { SendDmProcessor } from './send-dm.processor';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../queue/constants';
import { BillingModule } from '../billing/billing.module';

import { ReplyDeskService } from './reply-desk.service';

@Module({
  imports: [
    BillingModule,
    NotificationModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.INSTAGRAM_MEDIA_FETCH },
      { name: QUEUE_NAMES.SEND_DM },
    ),
  ],
  controllers: [InstagramController, WebhookController],
  providers: [
    InstagramService,
    AuditLogService,
    MediaFetchProducer,
    MediaFetchProcessor,
    InstagramCacheService,
    WebhookRouterService,
    CommentAutomationService,
    MessageAutomationService,
    SendDmProducer,
    SendDmProcessor,
    ReplyDeskService,
  ],
  exports: [
    InstagramService,
    MediaFetchProducer,
    InstagramCacheService,
    SendDmProducer,
    ReplyDeskService,
  ],
})
export class InstagramModule {}
