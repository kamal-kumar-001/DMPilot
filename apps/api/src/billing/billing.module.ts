import { Module, OnModuleInit } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { RazorpayWebhookController } from './razorpay-webhook.controller';
import { FeeFreeWebhookController } from './feefree-webhook.controller';
import { FeeFreeService } from './feefree.service';
import { SubscriptionService } from './subscription.service';
import { FeatureFlagService } from './feature-flag.service';
import { UsageLimitGuard } from './usage-limit.guard';
import { PlanGuard } from './plan.guard';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [BillingController, RazorpayWebhookController, FeeFreeWebhookController],
  providers: [SubscriptionService, FeatureFlagService, UsageLimitGuard, PlanGuard, FeeFreeService],
  exports: [SubscriptionService, FeatureFlagService, UsageLimitGuard, PlanGuard],
})
export class BillingModule implements OnModuleInit {
  constructor(
    private readonly featureFlag: FeatureFlagService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async onModuleInit() {
    await this.featureFlag.seedDefaults();
    await this.subscriptionService.seedPlansDefaults();
    await this.subscriptionService.seedPromoDefaults();
  }
}
