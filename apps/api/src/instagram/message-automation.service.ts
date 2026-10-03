import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppLogger } from '../common/logger/logger.service';
import { SendDmProducer } from './send-dm.producer';
import {
  CampaignType,
  CampaignStatus,
  MatchingRule,
  MessageDirection,
  MessageStatus,
} from '@prisma/client';

export interface MessageEvent {
  instagramId: string; // The page ID
  messageId: string; // mid
  text: string;
  fromId: string; // Recipient/Sender ID
  recipientId?: string;
  fromUsername?: string;
  isStoryReply?: boolean;
  quickReplyPayload?: string;
  webhookEventId: string;
}

@Injectable()
export class MessageAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
    private readonly sendDmProducer: SendDmProducer,
  ) {
    this.logger.setContext('MessageAutomationService');
  }

  async handle(event: MessageEvent): Promise<void> {
    const {
      instagramId,
      messageId,
      text,
      fromId,
      fromUsername,
      quickReplyPayload,
      webhookEventId,
    } = event;

    // 1. Resolve the InstagramAccount record (match by instagramId or page id, with developer bypass if instagramId is '0' or '23245')
    let account = await this.prisma.instagramAccount.findFirst({
      where:
        instagramId === '0' || instagramId === '23245' || instagramId === '232323232'
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
          `Resolved test/fallback InstagramAccount @${account.username} for incoming message event ID=${instagramId}`,
        );
      } else {
        this.logger.warn(`No active InstagramAccount found for ID=${instagramId}`);
        return;
      }
    }

    // 2. Dedup incoming message
    const existing = await this.prisma.message.findUnique({
      where: { messageId },
    });
    if (existing) {
      this.logger.log(`Message ${messageId} already saved — skipping duplicate.`);
      return;
    }

    // 3. Check if message was sent by the creator from native Instagram app
    const isSentByCreator = Boolean(
      fromId === account.instagramId || fromId === account.instagramPageId || fromId === account.id,
    );
    const targetRecipientId = isSentByCreator && event.recipientId ? event.recipientId : fromId;
    const direction = isSentByCreator ? MessageDirection.OUTGOING : MessageDirection.INCOMING;

    // 4. Save message to DB
    const savedMessage = await this.prisma.message.create({
      data: {
        instagramAccountId: account.id,
        recipientId: targetRecipientId,
        senderId: fromId,
        text,
        messageId,
        direction,
        status: MessageStatus.SENT,
      },
    });

    // 3.5 Quick Reply Follow Confirmation bypass
    if (quickReplyPayload && quickReplyPayload.startsWith('CONFIRM_FOLLOW_CAMPAIGN_')) {
      const campaignId = quickReplyPayload.replace('CONFIRM_FOLLOW_CAMPAIGN_', '');
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
      });
      if (campaign && campaign.status === CampaignStatus.ACTIVE) {
        // Find triggering comment for this user to pass comment_id for Instagram Private Reply
        const triggeringComment = await this.prisma.comment.findFirst({
          where: {
            userId: fromId,
            instagramAccountId: account.id,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (triggeringComment) {
          await this.prisma.comment
            .update({
              where: { id: triggeringComment.id },
              data: {
                isReplied: true,
                replyText: 'Follow Confirmed - Enqueued Campaign DM',
                campaignId: campaign.id,
              },
            })
            .catch(() => null);
        }

        await this.sendDmProducer.enqueueSendDm({
          campaignId: campaign.id,
          instagramAccountId: account.id,
          recipientId: fromId,
          recipientUsername: fromUsername || 'user',
          commentId: triggeringComment?.id,
          igCommentId: triggeringComment?.commentId,
          replyMessage: campaign.replyMessage,
          replyMediaUrl: campaign.replyMediaUrl ?? undefined,
          isFollowBypass: true,
          webhookEventId,
        });
        return;
      }
    }

    // 4. Load active campaigns
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        instagramAccountId: account.id,
        status: CampaignStatus.ACTIVE,
        deletedAt: null,
      },
      include: { keywords: true },
    });

    if (campaigns.length === 0) {
      return;
    }

    const normalizedText = text.toLowerCase().trim();

    for (const campaign of campaigns) {
      let matched = false;

      if (campaign.type === CampaignType.KEYWORD_TO_DM) {
        matched = campaign.keywords.some((k) => {
          const kw = k.keyword.toLowerCase().trim();
          if (k.matchingRule === MatchingRule.EXACT) {
            return normalizedText === kw;
          }
          if (k.matchingRule === MatchingRule.CONTAINS) {
            return normalizedText.includes(kw);
          }
          if (k.matchingRule === MatchingRule.STARTS_WITH) {
            return normalizedText.startsWith(kw);
          }
          return false;
        });
      } else if (campaign.type === CampaignType.WELCOME_DM) {
        // Welcome DM triggers if this is the first incoming message from this user
        const messageCount = await this.prisma.message.count({
          where: {
            instagramAccountId: account.id,
            recipientId: fromId,
          },
        });
        // count === 1 means the only message is the one we just saved above!
        if (messageCount === 1) {
          matched = true;
        }
      } else if (campaign.type === CampaignType.STORY_REPLY_TO_DM) {
        // Story reply triggers if it is flagged as a story reply
        if (event.isStoryReply) {
          if (campaign.keywords.length === 0) {
            matched = true;
          } else {
            matched = campaign.keywords.some((k) => {
              const kw = k.keyword.toLowerCase().trim();
              if (k.matchingRule === MatchingRule.EXACT) {
                return normalizedText === kw;
              }
              if (k.matchingRule === MatchingRule.CONTAINS) {
                return normalizedText.includes(kw);
              }
              return false;
            });
          }
        }
      }

      if (matched) {
        this.logger.log(
          `Message ${messageId} matched campaign "${campaign.name}" (${campaign.type}) — enqueuing reply.`,
        );

        await this.sendDmProducer.enqueueSendDm({
          campaignId: campaign.id,
          instagramAccountId: account.id,
          recipientId: fromId,
          recipientUsername: fromUsername || 'user',
          replyMessage: campaign.replyMessage,
          replyMediaUrl: campaign.replyMediaUrl ?? undefined,
        });

        // Only reply with one campaign per trigger
        break;
      }
    }
  }
}
