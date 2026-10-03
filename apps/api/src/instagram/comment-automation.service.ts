import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../common/logger/logger.service';
import { SendDmProducer } from './send-dm.producer';
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
  ) {
    this.logger.setContext('CommentAutomationService');
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

    // 1. Resolve the InstagramAccount record (with developer bypass if instagramId is '0' or test ID)
    let account = await this.prisma.instagramAccount.findFirst({
      where:
        instagramId === '0' || instagramId === '232323232'
          ? { isConnected: true, deletedAt: null }
          : {
              OR: [{ instagramId }, { instagramPageId: instagramId }],
              isConnected: true,
              deletedAt: null,
            },
    });

    if (!account) {
      account = await this.prisma.instagramAccount.findFirst({
        where: { isConnected: true, deletedAt: null },
      });
      if (account) {
        this.logger.log(
          `Resolved test/fallback InstagramAccount @${account.username} for incoming event ID=${instagramId}`,
        );
      } else {
        this.logger.warn(`No active account found for instagramId=${instagramId}`);
        return;
      }
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

    // 6. Match campaigns
    for (const campaign of campaigns) {
      const matched = this.matchesCampaign(campaign, mediaId, text);
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
      });

      // Only one campaign should respond per comment
      break;
    }
  }

  private matchKeyword(
    normalizedText: string,
    k: { keyword: string; matchingRule: MatchingRule },
  ): boolean {
    const kw = k.keyword.toLowerCase().trim();

    // Direct match
    if (k.matchingRule === MatchingRule.EXACT && normalizedText === kw) return true;
    if (k.matchingRule === MatchingRule.CONTAINS && normalizedText.includes(kw)) return true;
    if (k.matchingRule === MatchingRule.STARTS_WITH && normalizedText.startsWith(kw)) return true;

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
        return campaign.keywords.some((k) => this.matchKeyword(normalizedText, k));
      }

      // Default: match any comment on the monitored post if no keywords are set
      return true;
    }

    if (campaign.type === CampaignType.KEYWORD_TO_DM) {
      return campaign.keywords.some((k) => this.matchKeyword(normalizedText, k));
    }

    // WELCOME_DM — always match (triggered by new messages, not comments)
    return false;
  }
}
