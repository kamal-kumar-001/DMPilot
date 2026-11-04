import { Injectable, NotFoundException, BadGatewayException } from '@nestjs/common';
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

  /** General audience comments, not a sales-intent classifier. No data is deleted. */
  async getBuyerQueries(userId: string): Promise<BuyerQueryItem[]> {
    const accounts = await this.prisma.instagramAccount.findMany({
      where: { userId, isConnected: true, deletedAt: null },
      select: { id: true, username: true, instagramId: true, instagramPageId: true },
    });
    if (!accounts.length) return [];
    const accountIds = accounts.map(a => a.id);
    const accountMap = Object.fromEntries(accounts.map(a => [a.id, a]));
    const normalize = (value: string) => value.trim().toLowerCase();
    const creatorHandles = new Set(accounts.map(a => normalize(a.username).replace(/^@/, '')));
    const creatorIds = new Set(accounts.flatMap(a => [a.instagramId, a.instagramPageId].filter(Boolean)));
    const keywords = await this.prisma.keyword.findMany({
      where: { campaign: { userId, status: 'ACTIVE', deletedAt: null, instagramAccountId: { in: accountIds } } },
      select: { keyword: true, campaign: { select: { instagramAccountId: true } } },
    });
    const byAccount = new Map<string, Set<string>>();
    for (const k of keywords) {
      const id = k.campaign.instagramAccountId;
      if (!byAccount.has(id)) byAccount.set(id, new Set());
      byAccount.get(id)!.add(normalize(k.keyword));
    }
    // Exclude exact triggers/known creator identities in SQL before the bounded
    // page, so a flood of keyword comments cannot push audience questions out.
    const excluded = accounts.flatMap(a => [
      ...[...creatorHandles].map(username => ({ username: { equals: username, mode: 'insensitive' as const } })),
      ...[...creatorIds].map(id => ({ userId: id! })),
      ...[...(byAccount.get(a.id) || [])].map(text => ({ instagramAccountId: a.id, text: { equals: text, mode: 'insensitive' as const } })),
    ]);
    const comments = await this.prisma.comment.findMany({
      where: { instagramAccountId: { in: accountIds }, NOT: { OR: excluded } },
      orderBy: [{ isReplied: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    return comments.filter(c => {
      if (creatorIds.has(c.userId) || creatorHandles.has(normalize(c.username).replace(/^@/, ''))) return false;
      return !byAccount.get(c.instagramAccountId)?.has(normalize(c.text));
    }).map(c => ({
      id: c.id, commentId: c.commentId, mediaId: c.mediaId, text: c.text,
      username: c.username, userId: c.userId, category: 'GENERAL' as const,
      intentScore: 0, suggestedReply: '', isReplied: c.isReplied, createdAt: c.createdAt,
      account: { id: c.instagramAccountId, username: accountMap[c.instagramAccountId].username },
    }));
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
          // Do not silently change the selected audience from public to private.
          throw new BadGatewayException('Public reply failed. Nothing was sent as a private DM.');
        }
      }
    } else {
      // Enqueue direct DM reply via SendDmProducer
      await this.sendDmProducer.enqueueSendDm({
        campaignId: 'manual',
        sourceFeature: 'REPLY_DESK',
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
