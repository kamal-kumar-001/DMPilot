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
import { AppLogger } from '../common/logger/logger.service';
import { WebhookIngestionProducer } from './webhook-ingestion.producer';
import * as crypto from 'crypto';

@Controller(['instagram/webhook', 'api/instagram/webhook'])
export class WebhookController {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
    private readonly ingestionProducer: WebhookIngestionProducer,
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

    // 1. Signature Integrity Validation (fail-closed, memory-only: <2ms)
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

    // 2. High-Throughput Decoupling (<15ms):
    // Push raw event into Redis BullMQ ingestion queue without waiting for DB transactions.
    try {
      await this.ingestionProducer.enqueueWebhook({
        entryId,
        body,
        receivedAt: Date.now(),
      });
    } catch (queueErr: any) {
      this.logger.error(`Failed to push webhook event into ingestion queue: ${queueErr?.message}`);
      // Return 200 OK regardless to prevent Meta from disabling endpoint on momentary queue hiccups
    }

    return { received: true };
  }
}
