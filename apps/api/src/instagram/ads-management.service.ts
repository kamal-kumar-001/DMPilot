import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { CreateAdCampaignDto, AdObjectiveDto } from './dto/content-publish.dto';

@Injectable()
export class AdsManagementService {
  private readonly logger = new Logger(AdsManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Creates or launches an Instagram Boosted Post / Ad Campaign.
   */
  async createBoostCampaign(userId: string, dto: CreateAdCampaignDto) {
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

    const dailyBudget = dto.dailyBudgetPaise || 50000; // default ₹500/day
    const objective = dto.objective || AdObjectiveDto.OUTCOME_ENGAGEMENT;

    const campaign = await this.prisma.adCampaign.create({
      data: {
        userId,
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

    this.logger.log(`Created Ad Campaign [${campaign.id}] for @${account.username}`);
    return campaign;
  }

  /**
   * Lists active and past ad campaigns for a creator with performance metrics.
   */
  async listCampaigns(userId: string, accountId?: string) {
    return this.prisma.adCampaign.findMany({
      where: {
        userId,
        ...(accountId ? { instagramAccountId: accountId } : {}),
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
