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
import { KeepcueForwardProducer } from './keepcue-forward.producer';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
// CANDIDATE addition (DM-scoped durable ingress boundary):
import {
  payloadContainsForwardableDm,
  readKeepcueForwardConfig,
  ingressAnchorJobPayloads,
} from './keepcue-forward';

@Controller(['instagram/webhook', 'api/instagram/webhook'])
export class WebhookController {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
    private readonly ingestionProducer: WebhookIngestionProducer,
    private readonly prisma: PrismaService,
    private readonly forwardProducer: KeepcueForwardProducer,
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
    const secrets = [
      this.configService.get('META_APP_SECRET')?.trim(),
      this.configService.get('INSTAGRAM_APP_SECRET')?.trim(),
    ].filter(Boolean) as string[];
    const body = req.body;
    const entryId = body?.entry?.[0]?.id || body?.sample?.value?.from?.id;

    // 1. Signature Integrity Validation (fail-closed, memory-only: <2ms)
    if (secrets.length === 0 || secrets.every((s) => s === 'change_me')) {
      this.logger.error(
        'Neither META_APP_SECRET nor INSTAGRAM_APP_SECRET is configured. Rejecting webhook event.',
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

    const provided = Buffer.from(signature);
    let signatureMatched = false;

    for (const secret of secrets) {
      if (secret === 'change_me') continue;
      const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      const expected = Buffer.from(`sha256=${hash}`);
      if (provided.length === expected.length && crypto.timingSafeEqual(provided, expected)) {
        signatureMatched = true;
        break;
      }
    }

    if (!signatureMatched) {
      this.logger.warn('Webhook rejected: HMAC signature mismatch.');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // 2. CANDIDATE (DM-scoped durable ingress boundary): durable-before-ack.
    // A 200 acknowledges the WHOLE POST to Meta, so a FORWARDABLE DM addressed
    // to a configured KeepCue recipient must hold its DURABLE anchor (the PG
    // outbox row) before ANY 200 - on the healthy path too, not only when the
    // ingestion enqueue fails. Redis queue jobs are accelerators/backup only:
    // Redis is not a crash-durable store (production runs AOF off / RDB
    // snapshots), so a queue-only anchor NEVER justifies an acknowledgment.
    const fwd = readKeepcueForwardConfig();
    const forwardEligible = fwd.enabled && payloadContainsForwardableDm(body, fwd.recipientIgIds);
    // 'anchored' only when every eligible DM holds a committed PG outbox row.
    let anchorState: 'anchored' | 'failed' | 'misconfigured' = 'anchored';
    if (forwardEligible && !fwd.appId) {
      // Fail closed: without the app identity no durable anchor can be built,
      // and acknowledging here would rest on a Redis-only ingestion job - the
      // exact pre-2.3.8 loss window. Worker-side owed-forward classification
      // cannot protect a pre-worker acknowledgment, so the POST is rejected
      // below (after best-effort ingestion) and the misconfiguration is loud.
      anchorState = 'misconfigured';
      this.logger.error(
        'KeepCue forward is enabled with configured recipients but no app identity (KEEPCUE_FORWARD_APP_ID/META_APP_ID); rejecting forwardable DM events rather than acknowledging without a durable anchor',
      );
    } else if (forwardEligible) {
      // Batch-atomic: ONE createMany covers EVERY eligible DM in the POST, so
      // a 200 below means every eligible message is PG-anchored. Non-eligible
      // messages in a mixed POST stay baseline best-effort (unchanged).
      const anchors = ingressAnchorJobPayloads(body, fwd);
      try {
        await this.prisma.dmForwardOutbox.createMany({ data: anchors, skipDuplicates: true });
      } catch (outboxErr: any) {
        anchorState = 'failed';
        this.logger.error(`Durable DM anchor: outbox write failed (${outboxErr?.message})`);
      }
      // Queue anchors are accelerators/backup only: Redis is not a
      // crash-durable store (production runs AOF off / RDB snapshots), so
      // they never justify an acknowledgment. Identity-only when the PG rows
      // committed (loss recovered by the reconciler's checkpointed sweep);
      // carrying dispatch bytes when they did not (may still save the event
      // if Meta never redelivers and Redis survives).
      for (const anchor of anchors) {
        try {
          await this.forwardProducer.anchorEnqueue(anchor, {
            includeRawBody: anchorState !== 'anchored',
          });
        } catch (anchorErr: any) {
          this.logger.warn(
            `Queue anchor failed for message ${anchor.messageId}: ${anchorErr?.message}`,
          );
        }
      }
    }

    // 3. High-Throughput Decoupling (<15ms):
    // Push raw event into Redis BullMQ ingestion queue without waiting for DB transactions.
    // Always attempted, even when the POST is rejected below: unrelated
    // sibling events in a mixed POST keep their baseline best-effort chance
    // (a 503 does not depend on Meta redelivery for them to be ingested).
    // If the ingestion job is lost after a 200 (Redis crash), WebhookEvent
    // persistence and non-forward processing for this POST are still lost
    // with it - the pre-existing baseline boundary for ALL event types,
    // unchanged by this candidate.
    try {
      await this.ingestionProducer.enqueueWebhook({
        entryId,
        body,
        receivedAt: Date.now(),
      });
    } catch (queueErr: any) {
      this.logger.error(`Failed to push webhook event into ingestion queue: ${queueErr?.message}`);
      // Fall through: eligible forwardable DMs are already PG-anchored (or the
      // POST is rejected below); for everything else a 200 despite a queue
      // hiccup is the baseline behavior that keeps Meta from disabling the endpoint.
    }

    if (forwardEligible && anchorState !== 'anchored') {
      // Whether and how long Meta retries a 503 is Meta's behavior, not a
      // guarantee this design relies on; the rejected alternative (200) would
      // make the same loss silent and certain-on-crash instead of loud.
      throw new ServiceUnavailableException(
        anchorState === 'misconfigured'
          ? 'KeepCue forward misconfigured (no app identity); rejecting so the DM event is not acknowledged without a durable anchor'
          : 'Durable DM anchor unavailable; rejecting so Meta retries the DM event',
      );
    }

    return { received: true };
  }
}
