import { NotificationModule } from '../notification/notification.module';
import { Module } from '@nestjs/common';
import { InstagramController } from './instagram.controller';
import { InstagramService } from './instagram.service';
import { WebhookController } from './webhook.controller';
import { ContentController } from './content.controller';
import { ContentPublishService } from './content-publish.service';
import { AdsController } from './ads.controller';
import { AdsManagementService } from './ads-management.service';
import { AuditLogService } from '../auth/audit-log.service';
import { TesterAccessService } from './tester-access.service';
import { MediaFetchProducer } from './media-fetch.producer';
import { MediaFetchProcessor } from './media-fetch.processor';
import { InstagramCacheService } from './instagram-cache.service';
import { WebhookRouterService } from './webhook-router.service';
import { CommentAutomationService } from './comment-automation.service';
import { MessageAutomationService } from './message-automation.service';
import { SendDmProducer } from './send-dm.producer';
import { SendDmProcessor } from './send-dm.processor';
import { KeepcueForwardService } from './keepcue-forward.service';
import { KeepcueForwardProducer } from './keepcue-forward.producer';
import {
  KeepcueForwardProcessor,
  KeepcueForwardAnchorProcessor,
} from './keepcue-forward.processor';
import { KeepcueForwardReconciler } from './keepcue-forward.reconciler';
import { WebhookIngestionProducer } from './webhook-ingestion.producer';
import { WebhookIngestionProcessor } from './webhook-ingestion.processor';
import { ScheduledPublishExecutor } from './scheduled-publish.processor';
import { ScheduledPublishWorker } from './scheduled-publish.worker';
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
      { name: QUEUE_NAMES.WEBHOOK_INGESTION },
      { name: QUEUE_NAMES.SCHEDULED_PUBLISH },
      { name: QUEUE_NAMES.KEEPCUE_DM_FORWARD },
      { name: QUEUE_NAMES.KEEPCUE_DM_FORWARD_ANCHOR },
    ),
  ],
  controllers: [InstagramController, WebhookController, ContentController, AdsController],
  providers: [
    InstagramService,
    ContentPublishService,
    AdsManagementService,
    AuditLogService,
    TesterAccessService,
    MediaFetchProducer,
    MediaFetchProcessor,
    InstagramCacheService,
    WebhookRouterService,
    CommentAutomationService,
    MessageAutomationService,
    SendDmProducer,
    SendDmProcessor,
    WebhookIngestionProducer,
    WebhookIngestionProcessor,
    ScheduledPublishExecutor,
    ScheduledPublishWorker,
    ReplyDeskService,
    KeepcueForwardService,
    KeepcueForwardProducer,
    KeepcueForwardProcessor,
    KeepcueForwardAnchorProcessor,
    KeepcueForwardReconciler,
  ],
  exports: [
    InstagramService,
    ContentPublishService,
    AdsManagementService,
    MediaFetchProducer,
    InstagramCacheService,
    SendDmProducer,
    WebhookIngestionProducer,
    ReplyDeskService,
  ],
})
export class InstagramModule {}
