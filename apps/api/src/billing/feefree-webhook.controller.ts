import { ServiceAccessService } from './service-access.service';
import {
  Controller,
  SetMetadata,
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
    private readonly serviceAccess: ServiceAccessService,
  ) {}

  @Post()
  @SetMetadata('rawWebhookAck', true)
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

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Freshness: reject replayed deliveries older than the tolerance window.
    // The HMAC covers the raw body only, so the trusted timestamp is the one
    // inside the signed payload. The X-FeeFree-Timestamp header (set by FeeFree
    // from the same value) must match it when present and is never trusted on
    // its own - an attacker replaying an old signed body could rewrite it.
    const bodyTs = Number(payload?.timestamp);
    if (
      !Number.isFinite(bodyTs) ||
      Math.abs(Date.now() - bodyTs) > WEBHOOK_TIMESTAMP_TOLERANCE_MS
    ) {
      throw new UnauthorizedException('Stale or invalid webhook timestamp');
    }
    const headerTs = Number(timestamp);
    if (Number.isFinite(headerTs) && headerTs !== bodyTs) {
      throw new UnauthorizedException('Webhook timestamp header does not match signed payload');
    }

    if (
      ['service.access.provisional', 'service.access.revoked'].includes(payload?.event) &&
      payload?.data?.event !== payload.event
    )
      throw new BadRequestException('Service event envelope mismatch');
    if (['service.access.provisional', 'service.access.revoked'].includes(payload?.event))
      return this.serviceAccess.accept(payload.event, payload.data?.eventId, payload.data);

    if (payload?.event !== 'payment.success') {
      // Other FeeFree events are acknowledged but do not change billing state.
      return { received: true, handled: false };
    }

    return this.subscriptionService.fulfillFeeFreePayment(payload.data || {});
  }
}
