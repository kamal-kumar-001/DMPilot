import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Query,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../common/logger/logger.service';
import { WebhookRouterService } from './webhook-router.service';
import * as crypto from 'crypto';

@Controller(['instagram/webhook', 'api/instagram/webhook'])
export class WebhookController {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    private readonly webhookRouter: WebhookRouterService,
  ) {
    this.logger.setContext('WebhookController');
  }

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') verifyToken: string,
    @Res() res: Response,
  ) {
    const configuredToken = this.configService.get('META_WEBHOOK_VERIFY_TOKEN')?.trim();
    this.logger.log(`Webhook GET verification request: mode=${mode}`);

    if (mode === 'subscribe' && verifyToken === configuredToken) {
      this.logger.log('Meta Webhook challenge verified successfully');
      res.setHeader('Content-Type', 'text/plain');
      return res.status(HttpStatus.OK).send(challenge);
    }

    this.logger.warn(`Failed webhook verification challenge. Received token: ${verifyToken}`);
    throw new ForbiddenException('Webhook verification token mismatch');
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async receive(@Req() req: Request) {
    const signature = req.headers['x-hub-signature-256'] as string;
    const appSecret = (
      this.configService.get('META_APP_SECRET') || this.configService.get('INSTAGRAM_APP_SECRET')
    )?.trim();
    const body = req.body;
    const entryId = body?.entry?.[0]?.id || body?.sample?.value?.from?.id;

    this.logger.log(
      `Incoming Webhook POST received. Entry ID: ${entryId || 'unknown'}, entries: ${Array.isArray(body?.entry) ? body.entry.length : 0}`,
    );

    // 1. Signature Integrity Validation (fail-closed)
    // Every POST must carry a valid x-hub-signature-256 HMAC of the raw body,
    // computed with the Meta/Instagram app secret. Unsigned or mismatched events
    // are rejected: the endpoint path is public knowledge, so without this check
    // anyone could fabricate Instagram events and fire users' automations.
    if (!appSecret || appSecret === 'change_me') {
      this.logger.error(
        'META_APP_SECRET / INSTAGRAM_APP_SECRET is not configured. Rejecting webhook event - signature validation is mandatory.',
      );
      throw new ServiceUnavailableException(
        'Webhook signature validation is not configured on the server',
      );
    }

    if (!signature) {
      this.logger.warn('Webhook rejected: missing x-hub-signature-256 header.');
      throw new UnauthorizedException('Missing webhook signature');
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      this.logger.error('Webhook rejected: rawBody buffer is missing, cannot validate HMAC.');
      throw new UnauthorizedException('Unable to validate webhook signature');
    }

    const hash = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const expectedSignature = `sha256=${hash}`;
    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      this.logger.warn('Webhook rejected: HMAC signature mismatch.');
      throw new UnauthorizedException('Invalid webhook signature');
    }
    this.logger.log('HMAC signature verification passed.');

    // 2. Signature valid - only now is the event trusted enough to persist and route.
    //    Save to DB first for complete auditing.
    let savedEventId: string | null = null;
    try {
      const saved = await this.prisma.webhookEvent.create({
        data: {
          eventId: entryId ? `${entryId}_${Date.now()}` : undefined,
          payload: body,
          status: 'PENDING',
        },
      });
      savedEventId = saved.id;
      this.logger.log(`Logged webhook event in DB. Entry ID: ${entryId || 'unknown'}`);
    } catch (error) {
      this.logger.error(
        'Failed to log Meta webhook event to DB',
        error instanceof Error ? error.stack : undefined,
      );
    }

    // Check if webhooks are paused
    const pausedSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'webhook_processing_paused' },
    });
    const isPaused = pausedSetting?.value === 'true';

    if (isPaused) {
      if (savedEventId) {
        await this.prisma.webhookEvent
          .update({
            where: { id: savedEventId },
            data: {
              status: 'PAUSED',
              errorMessage: 'Webhook processing is currently paused by admin.',
            },
          })
          .catch(() => null);
      }
      return { received: true, paused: true };
    }

    // 3. Fire-and-forget routing
    if (savedEventId) {
      this.webhookRouter
        .route(savedEventId, body)
        .catch((err) => this.logger.error('WebhookRouter unhandled error', err?.stack));
    }

    return { received: true };
  }
}
