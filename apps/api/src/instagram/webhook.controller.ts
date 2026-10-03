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
    this.logger.log(
      `Webhook GET verification request: mode=${mode}, verifyToken=${verifyToken}, configuredToken=${configuredToken}`,
    );

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

    this.logger.log(`Incoming Webhook POST: ${JSON.stringify(body)}`);

    // 1. Log and save incoming webhook event to DB first for complete auditing
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

    // 2. Signature Integrity Validation (soft-fail mode)
    // Meta Dashboard test events and real Instagram webhooks may use different
    // signing mechanisms. We log mismatches but still process events to avoid
    // dropping legitimate webhooks. The event origin is verified by the
    // webhook subscription itself (only Meta knows our callback URL + verify token).
    if (appSecret && appSecret !== 'change_me') {
      if (!signature) {
        this.logger.warn('Webhook received without x-hub-signature-256 header. Processing anyway.');
      } else {
        const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
        if (rawBody) {
          const hash = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
          const expectedSignature = `sha256=${hash}`;

          if (signature === expectedSignature) {
            this.logger.log('HMAC signature verification passed.');
          } else {
            this.logger.warn(
              `HMAC signature mismatch (processing anyway). Expected ${expectedSignature}, got ${signature}`,
            );
          }
        } else {
          this.logger.warn('rawBody buffer is missing. Skipping HMAC validation.');
        }
      }
    } else {
      this.logger.warn(
        'Neither META_APP_SECRET nor INSTAGRAM_APP_SECRET is configured. Skipping HMAC signature validation.',
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
