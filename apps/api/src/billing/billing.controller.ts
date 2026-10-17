import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { SubscriptionService } from './subscription.service';
import { FeatureFlagService } from './feature-flag.service';
import { Plan, BillingCycle } from '@prisma/client';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly featureFlagService: FeatureFlagService,
  ) {}

  /** GET /billing/subscription — current user's subscription */
  @Get('subscription')
  getSubscription(@GetUser() user: { id: string }) {
    return this.subscriptionService.getOrCreate(user.id);
  }

  /** GET /billing/plans — all available plans with metadata */
  @Get('plans')
  getPlans() {
    return this.subscriptionService.getPlans();
  }

  /** GET /billing/usage — current period usage vs limits */
  @Get('usage')
  getUsage(@GetUser() user: { id: string }) {
    return this.subscriptionService.getUsageSummary(user.id);
  }

  /** GET /billing/limits — plan limits for current user */
  @Get('limits')
  getLimits(@GetUser() user: { id: string }) {
    return this.subscriptionService.getLimits(user.id);
  }

  /** GET /billing/flags — feature flags visible to user's plan */
  @Get('flags')
  async getFlags(@GetUser() user: { id: string }) {
    const sub = await this.subscriptionService.getOrCreate(user.id);
    const allFlags = await this.featureFlagService.getAll();
    return allFlags.map((f) => ({
      key: f.key,
      description: f.description,
      enabled: f.isEnabled && f.enabledForPlans.split(',').includes(sub.plan),
    }));
  }

  @Post('checkout')
  createCheckoutSession(
    @GetUser() user: { id: string },
    @Body('plan') plan: Plan,
    @Body('cycle') cycle?: BillingCycle,
    @Body('billingDetails') billingDetails?: any,
  ) {
    return this.subscriptionService.createCheckoutSession(
      user.id,
      plan,
      cycle || BillingCycle.MONTHLY,
      billingDetails,
    );
  }

  /** GET /billing/invoices — invoice history for current user */
  @Get('invoices')
  getInvoices(@GetUser() user: { id: string }) {
    return this.subscriptionService.getInvoices(user.id);
  }

  /** GET /billing/invoices/:id/receipt — individual printable receipt */
  @Get('invoices/:id/receipt')
  getInvoiceReceipt(@GetUser() user: { id: string }, @Param('id') invoiceId: string) {
    return this.subscriptionService.getInvoiceReceipt(user.id, invoiceId);
  }

  /** POST /billing/cancel — cancel subscription auto-renewal */
  @Post('cancel')
  cancelSubscription(
    @GetUser() user: { id: string },
    @Body() body?: { reason?: string; feedback?: string },
  ) {
    return this.subscriptionService.cancelSubscription(user.id, body);
  }
}
