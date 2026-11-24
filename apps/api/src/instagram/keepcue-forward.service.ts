/**
 * CANDIDATE — source-only, not deployed, gated OFF by default.
 * Enqueues Meta-verified forwardable DMs into the durable outbox.
 * Fail-safe: never throws into the webhook pipeline.
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import {
  detectForwardableDm,
  buildBridgeBody,
  readKeepcueForwardConfig,
  normalizeProviderEventTime,
  resolveIgUsername,
  ForwardEnqueueOutcome,
  KeepcueForwardPersistError,
} from './keepcue-forward';
import { KeepcueForwardProducer } from './keepcue-forward.producer';

@Injectable()
export class KeepcueForwardService {
  private readonly logger = new Logger(KeepcueForwardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly producer: KeepcueForwardProducer,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Resolve a DM sender's @handle the same way the DM inbox does
   * (instagram.service.ts): the recipient account's stored page token,
   * decrypted, then Meta Graph User Profile lookup. Never throws: any
   * failure degrades to null and KeepCue shows its ig_user_ fallback.
   */
  private async resolveSenderUsername(
    recipientIgId: string,
    igsid: string,
  ): Promise<string | null> {
    try {
      const account = await this.prisma.instagramAccount.findFirst({
        where: {
          OR: [{ instagramId: recipientIgId }, { instagramPageId: recipientIgId }],
          isConnected: true,
          deletedAt: null,
        },
        select: { accessToken: true },
      });
      if (!account?.accessToken) return null;
      const token = this.encryptionService.decrypt(account.accessToken);
      if (token.includes('mock') || token.includes('placeholder')) return null;
      return await resolveIgUsername(igsid, token);
    } catch (err) {
      this.logger.warn(
        `KeepCue forward username resolve failed (continuing without handle): ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Called from the webhook router AFTER the normal automation path. Only
   * forwards when: gate on, recipient is the designated KeepCue business
   * account, and the DM is a link code or shared media. Dedupes on the
   * composite event identity; Meta redelivery can never double-forward.
   */
  async maybeForward(input: {
    recipientId?: string;
    fromId: string;
    messageId: string;
    text?: string;
    igUsername?: string | null;
    sharedMedia?: { url?: string } | null;
    providerEventTimestamp?: number | null;
  }): Promise<ForwardEnqueueOutcome> {
    try {
      const config = readKeepcueForwardConfig();
      if (!config.enabled) return 'skipped_gate_off';
      if (!input.recipientId || !config.recipientIgIds.includes(input.recipientId))
        return 'skipped_recipient';
      const forward = detectForwardableDm(input);
      if (!forward) return 'no_forwardable_content';
      const igUsername =
        input.igUsername ?? (await this.resolveSenderUsername(input.recipientId, input.fromId));
      if (!config.appId || !config.bridgeUrl) {
        // Owed but undeliverable: recovery must NOT treat this as resolved.
        this.logger.error(
          'KeepCue forward enabled but KEEPCUE_FORWARD_APP_ID/KEEPCUE_BRIDGE_URL missing',
        );
        return 'skipped_misconfigured';
      }
      const rawBody = buildBridgeBody({
        appId: config.appId,
        recipientIgId: input.recipientId,
        igsid: input.fromId,
        messageId: input.messageId,
        igUsername,
        forward,
        providerEventTimestamp: normalizeProviderEventTime(input.providerEventTimestamp),
      });
      let created;
      try {
        created = await this.prisma.dmForwardOutbox.createMany({
          data: [
            {
              appId: config.appId,
              recipientIgId: input.recipientId,
              igsid: input.fromId,
              messageId: input.messageId,
              rawBody,
            },
          ],
          skipDuplicates: true,
        });
      } catch (persistErr) {
        // The durable insert itself failed (transient PG failure). NEVER
        // swallow this: the router records the owed forward on the durable
        // webhookEvent row (marker in errorMessage) and the reconciler
        // re-drives forwarding from the stored payload. Swallowing here is
        // how an event is silently lost after the controller's 200.
        throw new KeepcueForwardPersistError(input.messageId, persistErr);
      }
      if (created.count === 0) return 'duplicate'; // redelivery: already outboxed
      try {
        await this.producer.enqueueDispatch(
          config.appId,
          input.recipientId,
          input.fromId,
          input.messageId,
        );
      } catch (enqueueErr) {
        // Outbox row COMMITTED but enqueue failed (queue down): NOT swallowed -
        // the row stays PENDING and the reconciler re-enqueues it when the
        // queue recovers. Durable across outage/crash/restart.
        this.logger.warn(
          `KeepCue forward enqueue failed; outbox row left PENDING for reconciler: ${(enqueueErr as Error).message}`,
        );
      }
      return 'persisted';
    } catch (err) {
      if (err instanceof KeepcueForwardPersistError) throw err;
      // The durable handoff failed for a message that WAS forwardable:
      // never resolve silently - surface exactly like a persist failure so
      // the router flags the durable event row for recovery.
      this.logger.warn(`KeepCue forward failed before durable handoff: ${(err as Error).message}`);
      throw new KeepcueForwardPersistError(input.messageId, err);
    }
  }
}

