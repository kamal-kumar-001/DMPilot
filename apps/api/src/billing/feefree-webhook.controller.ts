import {
  Controller,
  Post,
  Headers,
  Req,
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SubscriptionService } from './subscription.service';
import { ConfigService } from '../config/config.service';
import * as crypto from 'crypto';

// FeeFree signs each webhook with X-FeeFree-Signature (HMAC-SHA256 of the raw
// body with the merchant webhook secret) and X-FeeFree-Timestamp. Both are
// verified here and anything missing, stale or mismatched is rejected - the
// opposite of a soft-fail.
const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

@Controller('billing/webhook/feefree')
export class FeeFreeWebhookController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  async handleWebhook(
    @Headers('x-feefree-signature') signature: string,
    @Headers('x-feefree-timestamp') timestamp: string,
    @Req() req: Request,
  ) {
    const webhookSecret = this.configService.get('FEEFREE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('FeeFree webhook received but FEEFREE_WEBHOOK_SECRET is not configured');
      throw new ServiceUnavailableException('Webhook endpoint not properly configured');
    }

    if (!signature) {
      throw new UnauthorizedException('Missing x-feefree-signature header');
    }

    const rawBody =
      (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    const provided = Buffer.from(signature.startsWith('sha256=') ? signature.slice(7) : signature);
    const expected = Buffer.from(
      crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex'),
    );
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Freshness: reject replayed deliveries older than the tolerance window.
    const sentAt = Number(timestamp);
    if (
      !Number.isFinite(sentAt) ||
      Math.abs(Date.now() - sentAt) > WEBHOOK_TIMESTAMP_TOLERANCE_MS
    ) {
      throw new UnauthorizedException('Stale or invalid webhook timestamp');
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    if (payload?.event !== 'payment.success') {
      // Other FeeFree events are acknowledged but do not change billing state.
      return { received: true, handled: false };
    }

    return this.subscriptionService.fulfillFeeFreePayment(payload.data || {});
  }
}
