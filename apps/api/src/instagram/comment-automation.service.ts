import axios from 'axios';
import { EncryptionService } from '../common/encryption/encryption.service';
import { resolveActiveAccountForWebhookIds } from './webhook-account-resolver';
import { bindViaMediaOwnershipProof } from './webhook-ownership-binder';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../common/logger/logger.service';
import { SendDmProducer } from './send-dm.producer';
import { FeatureFlagService } from '../billing/feature-flag.service';
import { SubscriptionService } from '../billing/subscription.service';
import { CampaignType, CampaignStatus, MatchingRule } from '@prisma/client';

export interface CommentEvent {
  instagramId: string; // The page/IG account's instagramId
  commentId: string;
  mediaId: string;
  text: string;
  fromId: string; // Native Instagram user ID of the commenter
  fromUsername: string;
  webhookEventId: string;
}

@Injectable()
export class CommentAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    private readonly sendDmProducer: SendDmProducer,
    private readonly featureFlags: FeatureFlagService,
    private readonly subscriptions: SubscriptionService,
    private readonly encryptionService: EncryptionService,
  ) {
    this.logger.setContext('CommentAutomationService');
  }

  /**
   * Attempt a provider-witnessed binding for an unresolved identifier using
   * the commented media. At most one Meta API call per connected account;
   * any error fails closed (event still drops). Never throws.
   */
  private async tryOwnershipRebind(identifier: string, mediaId: string): Promise<boolean> {
    try {
      const accounts = await this.prisma.instagramAccount.findMany({
        where: { isConnected: true, deletedAt: null },
        select: { id: true, instagramId: true, accessToken: true },
      });
      const candidates = accounts.map((a) => ({
        id: a.id,
        instagramId: a.instagramId,
        accessToken: this.encryptionService.decrypt(a.accessToken),
      }));
      const probe = async (id: string, token: string) => {
        try {
          const res = await axios.get(`https://graph.instagram.com/v21.0/${id}`, {
            params: { fields: 'id,owner', access_token: token },
            timeout: 8000,
          });
          if (!res.data?.id) return null;
          // owner is returned ONLY when the token's user created the media.
          return {
            id: String(res.data.id),
            ownerId: res.data.owner?.id ? String(res.data.owner.id) : undefined,
          };
        } catch {
          return null; // any API/permission error = no proof, never a negative claim
        }
      };
      const result = await bindViaMediaOwnershipProof(this.prisma, {
        identifier,
        mediaId,
        candidates,
        probe,
      });
      if (result.bound) {
        this.logger.log(
          `Bound webhook identifier ${identifier} to account ${result.accountId} via media ownership proof.`,
        );
      } else {
        this.logger.warn(
          `Ownership proof for identifier ${identifier} did not bind: ${result.reason}`,
        );
      }
      return result.bound;
    } catch (err: any) {
      this.logger.warn(`Ownership proof error for ${identifier}: ${err?.message}`);
      return false;
    }
  }

  async handle(event: CommentEvent): Promise<void> {
    const { instagramId, commentId, mediaId, text, fromId, fromUsername, webhookEventId } = event;

    // 0. Store metadata on WebhookEvent record for diagnostic correlation
    if (webhookEventId) {
      await this.prisma.webhookEvent
        .update({
          where: { id: webhookEventId },
          data: {
            commentId,
            username: fromUsername,
            senderId: fromId,
          },
        })
        .catch(() => null);
    }

    // 1. Resolve the InstagramAccount record strictly matching the target instagramId
    //    (primary columns, then verified alias bindings - never webhook-learned)
    let resolution = await resolveActiveAccountForWebhookIds(this.prisma, [instagramId]);
    let account = resolution.account;

    // Provider-witnessed self-heal: an unresolved comment identifier can be
    // bound if exactly one connected account's own token can read the
    // commented media (Meta permission model = ownership proof).
    if (!account && !resolution.ambiguous && mediaId) {
      if (await this.tryOwnershipRebind(instagramId, mediaId)) {
        resolution = await resolveActiveAccountForWebhookIds(this.prisma, [instagramId]);
        account = resolution.account;
      }
    }

    if (!account) {
      this.logger.warn(
        `No active connected InstagramAccount found for instagramId=${instagramId}. Dropping event to prevent cross-account contamination.` +
          (resolution.ambiguous
            ? ` Ambiguous bindings: ${JSON.stringify(resolution.ambiguous)}`
            : ''),
      );
      return;
    }

    // 2. Dedup — skip if we have already processed this exact comment
    const existing = await this.prisma.comment.findUnique({ where: { commentId } });
    if (existing?.isReplied) {
      return;
    }

    // 3. Upsert the Comment record so we have it regardless of match
    const commentRecord = await this.prisma.comment.upsert({
      where: { commentId },
      create: {
        instagramAccountId: account.id,
        mediaId,
        commentId,
        text,
        username: fromUsername,
        userId: fromId,
        isReplied: false,
      },
      update: { text, username: fromUsername },
    });

    // 4. Find all active campaigns for this account
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        instagramAccountId: account.id,
        status: CampaignStatus.ACTIVE,
        deletedAt: null,
      },
      include: { keywords: true, posts: true },
    });

    if (campaigns.length === 0) {
      return;
    }

    // 5. Check if user previously confirmed follow status for this account
    const previousConfirmation = await this.prisma.comment.findFirst({
      where: {
        instagramAccountId: account.id,
        userId: fromId,
        isReplied: true,
      },
    });
    const isUserFollowConfirmed = Boolean(
      previousConfirmation &&
      previousConfirmation.replyText &&
      !previousConfirmation.replyText.includes('First, make sure you follow') &&
      !previousConfirmation.replyText.includes('Failed:'),
    );

    const sub = await this.subscriptions.getOrCreate(account.userId);
    const hinglishEnabled = await this.featureFlags.isEnabled('MULTILINGUAL_HINGLISH', sub.plan);

    // 6. Match campaigns
    for (const campaign of campaigns) {
      const matched = this.matchesCampaign(campaign, mediaId, text, hinglishEnabled);
      if (!matched) continue;

      this.logger.log(
        `Comment ${commentId} matched campaign "${campaign.name}" (${campaign.type}) — enqueuing DM. (followBypass=${isUserFollowConfirmed})`,
      );

      // Update Comment record to associate it with the matched campaign
      await this.prisma.comment
        .update({
          where: { id: commentRecord.id },
          data: { campaignId: campaign.id },
        })
        .catch((e) =>
          this.logger.error(
            `Failed to associate comment ${commentRecord.id} with campaign ${campaign.id}: ${e.message}`,
          ),
        );

      await this.sendDmProducer.enqueueSendDm({
        campaignId: campaign.id,
        instagramAccountId: account.id,
        recipientId: fromId,
        recipientUsername: fromUsername,
        commentId: commentRecord.id,
        igCommentId: commentId,
        replyMessage: campaign.replyMessage,
        replyMediaUrl: campaign.replyMediaUrl ?? undefined,
        isFollowBypass: isUserFollowConfirmed,
        webhookEventId,
        jobId: `comment_${commentRecord.id}`,
      });

      // Only one campaign should respond per comment
      break;
    }
  }

  private matchKeyword(
    normalizedText: string,
    k: { keyword: string; matchingRule: MatchingRule },
    hinglishEnabled: boolean,
  ): boolean {
    const kw = k.keyword.toLowerCase().trim();

    // Direct match
    if (k.matchingRule === MatchingRule.EXACT && normalizedText === kw) return true;
    if (k.matchingRule === MatchingRule.CONTAINS && normalizedText.includes(kw)) return true;
    if (k.matchingRule === MatchingRule.STARTS_WITH && normalizedText.startsWith(kw)) return true;

    if (!hinglishEnabled) return false;

    // Hinglish & Regional Intent Synonyms
    const hinglishSynonyms: Record<string, string[]> = {
      price: [
        'price',
        'prc',
        'rate',
        'cost',
        'dam',
        'kitne ka hai',
        'kitne ka h',
        'kya price hai',
        'price kya h',
        'how much',
        'कीमत',
        'விலை',
      ],
      link: ['link', 'lnk', 'link do', 'link bhejo', 'link karo', 'send link', 'url', 'लिंक'],
      info: ['info', 'details', 'detail', 'jaankari', 'batao', 'जानकारी', 'தகவல்'],
      buy: ['buy', 'order', 'khareedna', 'purchase', 'खरीदना', 'வாங்க'],
    };

    const synonyms = hinglishSynonyms[kw];
    if (synonyms) {
      return synonyms.some((syn) => normalizedText.includes(syn));
    }

    return false;
  }

  private matchesCampaign(
    campaign: {
      type: CampaignType;
      keywords: { keyword: string; matchingRule: MatchingRule }[];
      posts: { mediaId: string }[];
    },
    mediaId: string,
    text: string,
    hinglishEnabled: boolean,
  ): boolean {
    const normalizedText = text.toLowerCase().trim();

    if (
      campaign.type === CampaignType.COMMENT_TO_DM ||
      campaign.type === CampaignType.COMMENT_REPLY
    ) {
      // 1. Must match the monitored post (or bypass for Meta Developer test payloads)
      const isMonitoredPost =
        mediaId === '123123123' || campaign.posts.some((p) => p.mediaId === mediaId);
      if (!isMonitoredPost) return false;

      // 2. If keywords are specified, must also match at least one keyword (with Hinglish support)
      if (campaign.keywords.length > 0) {
        return campaign.keywords.some((k) => this.matchKeyword(normalizedText, k, hinglishEnabled));
      }

      // Default: match any comment on the monitored post if no keywords are set
      return true;
    }

    if (campaign.type === CampaignType.KEYWORD_TO_DM) {
      return campaign.keywords.some((k) => this.matchKeyword(normalizedText, k, hinglishEnabled));
    }

    // WELCOME_DM — always match (triggered by new messages, not comments)
    return false;
  }
}
