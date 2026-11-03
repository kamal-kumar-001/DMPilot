import { Controller, Post, Headers, Req, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { SubscriptionService } from './subscription.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Controller('billing/webhook')
export class RazorpayWebhookController {
  private readonly webhookSecret: string;

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly configService: ConfigService,
  ) {
    this.webhookSecret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET') || '';
  }

  @Post()
  async handleWebhook(@Headers('x-razorpay-signature') signature: string, @Req() req: Request) {
    if (!this.webhookSecret) {
      console.error('Razorpay Webhook secret is not configured in environment variables');
      throw new BadRequestException('Webhook endpoint not properly configured');
    }

    if (!signature) {
      throw new BadRequestException('Missing x-razorpay-signature header');
    }

    const rawBody =
      (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      console.error('Razorpay Webhook signature verification failed');
      throw new BadRequestException('Invalid signature');
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (event.event === 'payment_link.paid') {
      const paymentLink = event.payload?.payment_link?.entity || {};
      const paymentEntity = event.payload?.payment?.entity || {};
      const notes = paymentLink.notes || {};
      const userId = notes.userId;
      const plan = notes.plan;
      const cycle = notes.cycle || 'MONTHLY';
      const paymentId = paymentEntity.id || paymentLink.payment_id;
      const paymentLinkId = paymentLink.id;
      let billingDetails: any = null;
      try {
        billingDetails = notes.billingDetails ? JSON.parse(notes.billingDetails) : null;
      } catch (e) {
        // ignore parse error
      }

      // Re-check the paid amount and currency against the server-created payment
      // link before granting any plan. The link amount was fixed by this server
      // at creation (partial payments disabled), so a genuine payment must match
      // it exactly and be denominated in INR.
      const linkAmountPaise = Number(paymentLink.amount);
      const paidAmountPaise = Number(paymentEntity.amount);
      const paidCurrency = String(paymentEntity.currency || paymentLink.currency || '');
      if (
        !Number.isFinite(linkAmountPaise) ||
        !Number.isFinite(paidAmountPaise) ||
        paidAmountPaise < linkAmountPaise ||
        paidCurrency !== 'INR'
      ) {
        console.error(
          `Razorpay webhook rejected: amount/currency mismatch (link=${linkAmountPaise} paid=${paidAmountPaise} currency=${paidCurrency})`,
        );
        throw new BadRequestException('Payment amount or currency mismatch');
      }

      if (userId && plan) {
        await this.subscriptionService.changePlan(
          userId,
          plan,
          cycle,
          paymentId,
          paymentLinkId,
          billingDetails,
        );
      }
    }

    return { received: true };
  }
}
