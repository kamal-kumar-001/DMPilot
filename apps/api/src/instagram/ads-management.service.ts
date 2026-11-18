import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hashIdempotentPayload } from '../common/utils/request-hash';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { TesterAccessService } from './tester-access.service';
import { CreateAdCampaignDto, AdObjectiveDto } from './dto/content-publish.dto';

const AD_DELIVERY_DISCLOSURE = {
  deliveryMode: 'LOCAL_RECORD' as const,
  deliveryNote:
    'Recorded locally only: Meta Ads delivery is not connected, so this boost does not run ads or spend money.',
};

@Injectable()
export class AdsManagementService {
  private readonly logger = new Logger(AdsManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    @Optional() private readonly testerAccess?: TesterAccessService,
  ) {}

  /**
   * Creates or launches an Instagram Boosted Post / Ad Campaign.
   */
  async createBoostCampaign(userId: string, dto: CreateAdCampaignDto) {
    // Boosted posts use unreviewed Meta ads permissions: tester allowlist only.
    if (this.testerAccess) {
      await this.testerAccess.assertPrivilegedAction(
        userId,
        dto.instagramAccountId,
        'ads_boost_create',
      );
    }
    const account = await this.prisma.instagramAccount.findFirst({
      where: {
        id: dto.instagramAccountId,
        userId,
        isConnected: true,
        deletedAt: null,
      },
    });

    if (!account) {
      throw new NotFoundException('Instagram account not found or not connected');
    }

    // Idempotent create: a retry with the same clientRequestId returns the
    // original record instead of duplicating the campaign.
    const requestHash = dto.clientRequestId
      ? hashIdempotentPayload({
          instagramAccountId: dto.instagramAccountId,
          name: dto.name.trim(),
          dailyBudgetPaise: dto.dailyBudgetPaise || 50000,
          objective: dto.objective || null,
          mediaId: dto.mediaId || null,
        })
      : null;

    if (dto.clientRequestId) {
      const existing = await this.prisma.adCampaign.findFirst({
        where: { userId, clientRequestId: dto.clientRequestId },
        include: {
          instagramAccount: { select: { id: true, username: true, displayName: true } },
        },
      });
      if (existing) {
        if (existing.clientRequestHash && existing.clientRequestHash !== requestHash) {
          throw new ConflictException('clientRequestId was already used with a different payload');
        }
        return { ...existing, ...AD_DELIVERY_DISCLOSURE };
      }
    }

    const dailyBudget = dto.dailyBudgetPaise || 50000; // default ₹500/day
    const objective = dto.objective || AdObjectiveDto.OUTCOME_ENGAGEMENT;

    let campaign;
    try {
      campaign = await this.prisma.adCampaign.create({
        data: {
          userId,
          clientRequestId: dto.clientRequestId || null,
          clientRequestHash: requestHash,
          instagramAccountId: account.id,
          name: dto.name.trim(),
          objective: objective as any,
          status: 'ACTIVE',
          dailyBudgetPaise: dailyBudget,
          mediaId: dto.mediaId || null,
          // Synthetic realistic baseline stats for immediate creator feedback
          impressions: 0,
          clicks: 0,
          spendPaise: 0,
          messagesStarted: 0,
        },
        include: {
          instagramAccount: {
            select: {
              id: true,
              username: true,
              displayName: true,
            },
          },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        dto.clientRequestId
      ) {
        const existing = await this.prisma.adCampaign.findFirst({
          where: { userId, clientRequestId: dto.clientRequestId },
          include: {
            instagramAccount: { select: { id: true, username: true, displayName: true } },
          },
        });
        if (existing && existing.clientRequestHash === requestHash) {
          return { ...existing, ...AD_DELIVERY_DISCLOSURE };
        }
        if (existing)
          throw new ConflictException('clientRequestId was already used with a different payload');
      }
      throw error;
    }

    this.logger.log(`Created Ad Campaign [${campaign.id}] for @${account.username}`);
    // Honesty: Meta Ads delivery is not connected. This records a local
    // campaign draft only; nothing is delivered and nothing is spent.
    return { ...campaign, ...AD_DELIVERY_DISCLOSURE };
  }

  /**
   * Lists active and past ad campaigns for a creator with performance metrics.
   */
  async listCampaigns(userId: string, accountId?: string, allowedAccountIds?: string[]) {
    return this.prisma.adCampaign.findMany({
      where: {
        userId,
        ...(accountId ? { instagramAccountId: accountId } : {}),
        ...(allowedAccountIds && allowedAccountIds.length > 0
          ? { instagramAccountId: { in: allowedAccountIds } }
          : {}),
      },
      include: {
        instagramAccount: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Toggles campaign status between ACTIVE, PAUSED, and ARCHIVED.
   */
  async updateStatus(userId: string, campaignId: string, status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED') {
    const campaign = await this.prisma.adCampaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      throw new NotFoundException('Ad campaign not found');
    }

    // Pausing/archiving stops spend-side intent: safety actions stay open even
    // after tester access is revoked. Only (re)activation is tester-gated.
    if (status === 'ACTIVE' && this.testerAccess) {
      await this.testerAccess.assertPrivilegedAction(
        userId,
        campaign.instagramAccountId,
        'ads_status_activate',
      );
    }

    const updated = await this.prisma.adCampaign.update({
      where: { id: campaignId },
      data: { status: status as any },
    });

    this.logger.log(`Ad campaign [${campaignId}] status updated to ${status}`);
    return updated;
  }

  /**
   * Returns high-level performance metrics for all ad campaigns.
   */
  async getAdsSummary(userId: string) {
    const campaigns = await this.prisma.adCampaign.findMany({
      where: { userId },
      select: {
        dailyBudgetPaise: true,
        spendPaise: true,
        impressions: true,
        clicks: true,
        messagesStarted: true,
        status: true,
      },
    });

    const activeCampaignsCount = campaigns.filter((c) => c.status === 'ACTIVE').length;
    const totalSpendPaise = campaigns.reduce((acc, c) => acc + c.spendPaise, 0);
    const totalImpressions = campaigns.reduce((acc, c) => acc + c.impressions, 0);
    const totalClicks = campaigns.reduce((acc, c) => acc + c.clicks, 0);
    const totalMessages = campaigns.reduce((acc, c) => acc + c.messagesStarted, 0);

    return {
      activeCampaignsCount,
      totalSpendPaise,
      totalImpressions,
      totalClicks,
      totalMessages,
    };
  }
}
