import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { SendDmProducer } from './send-dm.producer';
import { EncryptionService } from '../common/encryption/encryption.service';
import { AuditLogService } from '../auth/audit-log.service';

export interface BuyerQueryItem {
  id: string;
  commentId: string;
  mediaId: string;
  text: string;
  username: string;
  userId: string;
  category: 'PRICE' | 'SHIPPING' | 'AVAILABILITY' | 'GENERAL';
  intentScore: number;
  suggestedReply: string;
  isReplied: boolean;
  createdAt: Date;
  account: {
    id: string;
    username: string;
  };
}

@Injectable()
export class ReplyDeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sendDmProducer: SendDmProducer,
    private readonly encryptionService: EncryptionService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /** Classify text into buyer intent category & suggested reply */
  private classifyIntent(text: string): {
    category: 'PRICE' | 'SHIPPING' | 'AVAILABILITY' | 'GENERAL';
    intentScore: number;
    suggestedReply: string;
  } {
    const lower = text.toLowerCase().trim();

    if (
      lower.includes('price') ||
      lower.includes('rate') ||
      lower.includes('cost') ||
      lower.includes('kitne ka') ||
      lower.includes('dam') ||
      lower.includes('how much') ||
      lower.includes('ticket price')
    ) {
      return {
        category: 'PRICE',
        intentScore: 95,
        suggestedReply: 'Hey! Thanks for asking. Sending you the complete details now! 📩',
      };
    }

    if (
      lower.includes('ship') ||
      lower.includes('delivery') ||
      lower.includes('mumbai') ||
      lower.includes('delhi') ||
      lower.includes('bangalore') ||
      lower.includes('pincode')
    ) {
      return {
        category: 'SHIPPING',
        intentScore: 88,
        suggestedReply:
          'Hi! We ship pan-India with fast delivery options. Check your DMs for details! 🚀',
      };
    }

    if (
      lower.includes('available') ||
      lower.includes('stock') ||
      lower.includes('size') ||
      lower.includes('color') ||
      lower.includes('m hai kya')
    ) {
      return {
        category: 'AVAILABILITY',
        intentScore: 90,
        suggestedReply:
          'Hey! Yes, this item is currently available. Check your DMs for options! ✨',
      };
    }

    return {
      category: 'GENERAL',
      intentScore: 80,
      suggestedReply: 'Hey! Thanks for reaching out. Sent you all the details! 🌟',
    };
  }

  /** Get all high-intent buyer queries for a creator's connected accounts */
  async getBuyerQueries(userId: string): Promise<BuyerQueryItem[]> {
    const accounts = await this.prisma.instagramAccount.findMany({
      where: { userId, isConnected: true, deletedAt: null },
      select: { id: true, username: true },
    });

    if (accounts.length === 0) return [];

    const accountIds = accounts.map((a) => a.id);
    const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]));
    const creatorHandlesSet = new Set(accounts.map((a) => a.username.toLowerCase().trim()));

    // Fetch user's active campaign trigger keywords to separate simple automated triggers
    const activeKeywords = await this.prisma.keyword.findMany({
      where: {
        campaign: { userId, status: 'ACTIVE', deletedAt: null },
      },
      select: { keyword: true },
    });

    const activeKeywordsSet = new Set(activeKeywords.map((k) => k.keyword.toLowerCase().trim()));

    // Fetch recent comments from connected accounts
    const comments = await this.prisma.comment.findMany({
      where: {
        instagramAccountId: { in: accountIds },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });

    // Filter out creator's own replies & simple single-word triggers
    return comments
      .filter((c) => {
        const textClean = c.text.toLowerCase().trim();
        const commentAuthor = c.username.toLowerCase().trim();

        // 1. EXCLUDE creator's own comments & automated bot replies
        if (
          creatorHandlesSet.has(commentAuthor) ||
          textClean.startsWith('sent!') ||
          textClean.startsWith('public reply:') ||
          textClean.startsWith('check your dms')
        ) {
          return false;
        }

        const words = textClean.split(/\s+/);

        // 2. Exclude simple single-word or two-word exact campaign keyword triggers (e.g. "ebook", "ticket", "link")
        if (words.length <= 2 && activeKeywordsSet.has(textClean) && !c.text.includes('?')) {
          return false;
        }

        // 3. Include genuine prospective buyer comments & inquiries
        const hasQuestionMark = c.text.includes('?');
        const hasBuyerKeyword =
          textClean.includes('price') ||
          textClean.includes('rate') ||
          textClean.includes('cost') ||
          textClean.includes('kitne') ||
          textClean.includes('dam') ||
          textClean.includes('ship') ||
          textClean.includes('delivery') ||
          textClean.includes('availab') ||
          textClean.includes('stock') ||
          textClean.includes('size') ||
          textClean.includes('how much') ||
          textClean.includes('where') ||
          textClean.includes('location') ||
          textClean.includes('timing');

        return (
          hasQuestionMark ||
          hasBuyerKeyword ||
          (words.length >= 2 && !activeKeywordsSet.has(textClean))
        );
      })
      .map((c) => {
        const intent = this.classifyIntent(c.text);
        return {
          id: c.id,
          commentId: c.commentId,
          mediaId: c.mediaId,
          text: c.text,
          username: c.username,
          userId: c.userId,
          category: intent.category,
          intentScore: intent.intentScore,
          suggestedReply: intent.suggestedReply,
          isReplied: c.isReplied,
          createdAt: c.createdAt,
          account: accountMap[c.instagramAccountId] || {
            id: c.instagramAccountId,
            username: 'creator',
          },
        };
      });
  }

  /** Dispatch 1-click reply from Reply Desk UI (Supports Public Comment Reply vs Private DM Reply) */
  async replyToBuyer(
    userId: string,
    commentDbId: string,
    replyText: string,
    replyMode: 'PUBLIC_COMMENT' | 'PRIVATE_DM' = 'PUBLIC_COMMENT',
  ): Promise<{ success: boolean }> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentDbId },
      include: { instagramAccount: true },
    });

    if (!comment || comment.instagramAccount.userId !== userId) {
      throw new NotFoundException('Comment not found or access denied');
    }

    if (replyMode === 'PUBLIC_COMMENT') {
      // Post public comment reply under the comment on Instagram
      const accessToken = this.encryptionService.decrypt(comment.instagramAccount.accessToken);
      if (!accessToken.startsWith('mock_')) {
        let repliedSuccessfully = false;
        for (const host of ['https://graph.instagram.com', 'https://graph.facebook.com']) {
          try {
            await axios.post(
              `${host}/v20.0/${comment.commentId}/replies`,
              { message: replyText },
              { params: { access_token: accessToken }, timeout: 10000 },
            );
            repliedSuccessfully = true;
            break;
          } catch {
            // Continue to fallback host
          }
        }
        if (!repliedSuccessfully) {
          // Fallback to DM if public reply fails
          await this.sendDmProducer.enqueueSendDm({
            campaignId: 'manual',
            instagramAccountId: comment.instagramAccountId,
            recipientId: comment.userId,
            recipientUsername: comment.username,
            commentId: comment.id,
            igCommentId: comment.commentId,
            replyMessage: replyText,
          });
        }
      }
    } else {
      // Enqueue direct DM reply via SendDmProducer
      await this.sendDmProducer.enqueueSendDm({
        campaignId: 'manual',
        instagramAccountId: comment.instagramAccountId,
        recipientId: comment.userId,
        recipientUsername: comment.username,
        commentId: comment.id,
        igCommentId: comment.commentId,
        replyMessage: replyText,
      });
    }

    // Mark comment as replied in DB
    await this.prisma.comment.update({
      where: { id: commentDbId },
      data: { isReplied: true, replyText },
    });

    await this.auditLogService.log({
      userId,
      action: 'REPLY_DESK_DISPATCH',
      details: JSON.stringify({
        commentId: comment.id,
        username: comment.username,
        mode: replyMode,
      }),
    });

    return { success: true };
  }
}
