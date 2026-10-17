import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { CampaignStatus } from '@prisma/client';
import { AuditLogService } from '../auth/audit-log.service';
import { AppLogger } from '../common/logger/logger.service';
import { SubscriptionService } from '../billing/subscription.service';

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: AppLogger,
    private readonly subscriptionService: SubscriptionService,
  ) {
    this.logger.setContext('CampaignService');
  }

  async create(userId: string, dto: CreateCampaignDto) {
    // 1. Verify that the Instagram Account is connected to this user
    const account = await this.prisma.instagramAccount.findFirst({
      where: { id: dto.instagramAccountId, userId, deletedAt: null },
    });

    if (!account) {
      throw new NotFoundException('Connected Instagram account not found');
    }

    // 2. Verify keyword quota limits
    if (dto.keywords && dto.keywords.length > 0) {
      const { limits } = await this.subscriptionService.getLimits(userId);
      if (limits.max_keywords !== -1 && dto.keywords.length > limits.max_keywords) {
        throw new ForbiddenException(
          `Keyword limit exceeded. Your plan allows a maximum of ${limits.max_keywords} keywords per campaign.`,
        );
      }
    }

    // 2. Perform nested database write to save campaign and trigger configurations
    const campaign = await this.prisma.campaign.create({
      data: {
        userId,
        instagramAccountId: dto.instagramAccountId,
        name: dto.name,
        description: dto.description || null,
        type: dto.type,
        replyMessage: dto.replyMessage,
        replyMediaUrl: dto.replyMediaUrl || null,
        commentReplyEnabled: dto.commentReplyEnabled ?? false,
        commentReplyText: dto.commentReplyText || null,
        followCheckEnabled: dto.followCheckEnabled ?? false,
        status: CampaignStatus.ACTIVE,
        keywords: dto.keywords
          ? {
              create: dto.keywords.map((k) => ({
                keyword: k.keyword.toLowerCase().trim(),
                matchingRule: k.matchingRule,
              })),
            }
          : undefined,
        posts: dto.posts
          ? {
              create: dto.posts.map((p) => ({
                mediaId: p.mediaId,
                mediaUrl: p.mediaUrl || null,
                permalink: p.permalink || null,
              })),
            }
          : undefined,
      },
      include: {
        keywords: true,
        posts: true,
      },
    });

    await this.subscriptionService.incrementUsage(userId, 'max_campaigns', 1);

    await this.auditLogService.log({
      userId,
      action: 'CAMPAIGN_CREATE',
      details: JSON.stringify({ id: campaign.id, name: campaign.name }),
    });

    return campaign;
  }

  async findAll(userId: string, search?: string, status?: CampaignStatus) {
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        userId,
        deletedAt: null,
        status: status ? status : { not: CampaignStatus.ARCHIVED },
        OR: search
          ? [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        keywords: true,
        posts: true,
        instagramAccount: {
          select: {
            username: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return Promise.all(
      campaigns.map(async (c) => {
        const sentCount = await this.prisma.message.count({
          where: { campaignId: c.id, status: { in: ['DELIVERED', 'SENT'] } },
        });
        const failedCount = await this.prisma.message.count({
          where: { campaignId: c.id, status: 'FAILED' },
        });
        const totalDms = sentCount + failedCount;
        const successRate = totalDms > 0 ? Math.round((sentCount / totalDms) * 100) : 100;

        return {
          ...c,
          metrics: {
            totalComments: c._count.comments,
            totalDmsSent: sentCount,
            failedDms: failedCount,
            successRate,
          },
        };
      }),
    );
  }

  async findOne(userId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        keywords: true,
        posts: true,
        instagramAccount: {
          select: {
            username: true,
            displayName: true,
          },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const sentCount = await this.prisma.message.count({
      where: { campaignId: campaign.id, status: { in: ['DELIVERED', 'SENT'] } },
    });
    const failedCount = await this.prisma.message.count({
      where: { campaignId: campaign.id, status: 'FAILED' },
    });
    const totalDms = sentCount + failedCount;
    const successRate = totalDms > 0 ? Math.round((sentCount / totalDms) * 100) : 100;

    return {
      ...campaign,
      metrics: {
        totalComments: campaign._count.comments,
        totalDmsSent: sentCount,
        failedDms: failedCount,
        successRate,
      },
    };
  }

  async update(userId: string, id: string, dto: UpdateCampaignDto) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Update core fields
    const updatedCampaign = await this.prisma.campaign.update({
      where: { id },
      data: {
        name: dto.name || undefined,
        description: dto.description || undefined,
        type: dto.type || undefined,
        instagramAccountId: dto.instagramAccountId || undefined,
        replyMessage: dto.replyMessage || undefined,
        replyMediaUrl: dto.replyMediaUrl || null,
        commentReplyEnabled:
          dto.commentReplyEnabled !== undefined ? dto.commentReplyEnabled : undefined,
        commentReplyText: dto.commentReplyText || null,
        followCheckEnabled:
          dto.followCheckEnabled !== undefined ? dto.followCheckEnabled : undefined,
      },
    });

    // Update keywords if provided
    if (dto.keywords) {
      if (dto.keywords.length > 0) {
        const { limits } = await this.subscriptionService.getLimits(userId);
        if (limits.max_keywords !== -1 && dto.keywords.length > limits.max_keywords) {
          throw new ForbiddenException(
            `Keyword limit exceeded. Your plan allows a maximum of ${limits.max_keywords} keywords per campaign.`,
          );
        }
      }
      await this.prisma.keyword.deleteMany({
        where: { campaignId: id },
      });
      if (dto.keywords.length > 0) {
        await this.prisma.keyword.createMany({
          data: dto.keywords.map((kw) => ({
            campaignId: id,
            keyword: kw.keyword,
            matchingRule: kw.matchingRule,
          })),
        });
      }
    }

    // Update posts if provided
    if (dto.posts) {
      await this.prisma.post.deleteMany({
        where: { campaignId: id },
      });
      if (dto.posts.length > 0) {
        await this.prisma.post.createMany({
          data: dto.posts.map((p) => ({
            campaignId: id,
            mediaId: p.mediaId,
            mediaUrl: p.mediaUrl,
            permalink: p.permalink,
          })),
        });
      }
    }

    await this.auditLogService.log({
      userId,
      action: 'CAMPAIGN_UPDATE',
      details: JSON.stringify({ id, updates: dto }),
    });

    return updatedCampaign;
  }

  async toggleStatus(userId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const nextStatus =
      campaign.status === CampaignStatus.ACTIVE ? CampaignStatus.PAUSED : CampaignStatus.ACTIVE;

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: nextStatus },
    });

    await this.auditLogService.log({
      userId,
      action: nextStatus === CampaignStatus.ACTIVE ? 'CAMPAIGN_RESUME' : 'CAMPAIGN_PAUSE',
      details: JSON.stringify({ id }),
    });

    return updated;
  }

  async duplicate(userId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        keywords: true,
        posts: true,
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign to duplicate not found');
    }

    // Clone parent record, append Copy, default status to PAUSED for safety review
    const cloned = await this.prisma.campaign.create({
      data: {
        userId,
        instagramAccountId: campaign.instagramAccountId,
        name: `${campaign.name} (Copy)`,
        description: campaign.description,
        type: campaign.type,
        replyMessage: campaign.replyMessage,
        replyMediaUrl: campaign.replyMediaUrl,
        status: CampaignStatus.PAUSED,
        keywords:
          campaign.keywords.length > 0
            ? {
                create: campaign.keywords.map((k) => ({
                  keyword: k.keyword,
                  matchingRule: k.matchingRule,
                })),
              }
            : undefined,
        posts:
          campaign.posts.length > 0
            ? {
                create: campaign.posts.map((p) => ({
                  mediaId: p.mediaId,
                  mediaUrl: p.mediaUrl,
                  permalink: p.permalink,
                })),
              }
            : undefined,
      },
      include: {
        keywords: true,
        posts: true,
      },
    });

    await this.subscriptionService.incrementUsage(userId, 'max_campaigns', 1);

    await this.auditLogService.log({
      userId,
      action: 'CAMPAIGN_DUPLICATE',
      details: JSON.stringify({ sourceId: id, targetId: cloned.id }),
    });

    return cloned;
  }

  async archive(userId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Set status to ARCHIVED (keep deletedAt null so it's in Archive, not Trash)
    await this.prisma.campaign.update({
      where: { id },
      data: {
        status: CampaignStatus.ARCHIVED,
      },
    });

    if (campaign.status !== CampaignStatus.ARCHIVED) {
      await this.subscriptionService.incrementUsage(userId, 'max_campaigns', -1);
    }

    await this.auditLogService.log({
      userId,
      action: 'CAMPAIGN_ARCHIVE',
      details: JSON.stringify({ id, name: campaign.name }),
    });

    return { message: 'Campaign archived successfully' };
  }

  async delete(userId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Soft delete: set deletedAt, pause status
    await this.prisma.campaign.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: CampaignStatus.PAUSED,
      },
    });

    if (campaign.status !== CampaignStatus.ARCHIVED) {
      await this.subscriptionService.incrementUsage(userId, 'max_campaigns', -1);
    }

    await this.auditLogService.log({
      userId,
      action: 'CAMPAIGN_DELETE',
      details: JSON.stringify({ id, name: campaign.name }),
    });

    return { message: 'Campaign moved to trash successfully' };
  }

  async restore(userId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id,
        userId,
        OR: [{ deletedAt: { not: null } }, { status: CampaignStatus.ARCHIVED }],
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found or not in trash/archive');
    }

    await this.prisma.campaign.update({
      where: { id },
      data: {
        deletedAt: null,
        status: CampaignStatus.PAUSED, // Restored in paused state so user can review and activate
      },
    });

    await this.subscriptionService.incrementUsage(userId, 'max_campaigns', 1);

    await this.auditLogService.log({
      userId,
      action: 'CAMPAIGN_RESTORE',
      details: JSON.stringify({ id, name: campaign.name }),
    });

    return { message: 'Campaign restored successfully (paused for review)' };
  }

  async permanentDelete(userId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, userId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    await this.prisma.campaign.delete({
      where: { id },
    });

    await this.auditLogService.log({
      userId,
      action: 'CAMPAIGN_PERMANENT_DELETE',
      details: JSON.stringify({ id, name: campaign.name }),
    });

    return { message: 'Campaign permanently deleted' };
  }

  async findArchivedAndDeleted(userId: string) {
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        userId,
        OR: [{ deletedAt: { not: null } }, { status: CampaignStatus.ARCHIVED }],
      },
      include: {
        keywords: true,
        posts: true,
        instagramAccount: {
          select: {
            username: true,
            displayName: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return campaigns.map((c) => ({
      ...c,
      isDeleted: c.deletedAt !== null,
      isArchived: c.status === CampaignStatus.ARCHIVED && c.deletedAt === null,
    }));
  }
}
