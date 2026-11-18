import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaign.dto';
import { CampaignStatus, Prisma } from '@prisma/client';
import { hashIdempotentPayload } from '../common/utils/request-hash';
import { AuditLogService } from '../auth/audit-log.service';
import { AppLogger } from '../common/logger/logger.service';
import { SubscriptionService } from '../billing/subscription.service';
import { FeatureFlagService } from '../billing/feature-flag.service';
import { CampaignType } from '@prisma/client';

/**
 * Normalize keyword input the same way on every write path and reject
 * duplicates after normalization: "Sale", "sale" and " sale " are one
 * keyword, and storing them twice wastes quota and double-counts matches.
 */
function normalizeKeywords(kws: { keyword: string; matchingRule: any }[]) {
  const seen = new Map<string, { keyword: string; matchingRule: any }>();
  for (const k of kws) {
    const keyword = (k.keyword || '').toLowerCase().trim();
    if (!keyword) {
      throw new BadRequestException('Keywords cannot be empty.');
    }
    if (seen.has(keyword)) {
      throw new BadRequestException(
        `Duplicate keyword "${keyword}". Keywords are case-insensitive; remove the duplicate.`,
      );
    }
    seen.set(keyword, { keyword, matchingRule: k.matchingRule });
  }
  return [...seen.values()];
}

/** Campaign types gated per plan by admin-controlled feature flags. */
const CAMPAIGN_TYPE_FLAG: Record<CampaignType, string> = {
  COMMENT_TO_DM: 'COMMENT_TO_DM',
  KEYWORD_TO_DM: 'KEYWORD_TO_DM',
  WELCOME_DM: 'WELCOME_DM',
  STORY_REPLY_TO_DM: 'STORY_REPLY_TO_DM',
  COMMENT_REPLY: 'COMMENT_REPLY',
  SHARE_TO_DM: 'SHARE_TO_DM',
};

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: AppLogger,
    private readonly subscriptionService: SubscriptionService,
    private readonly featureFlagService: FeatureFlagService,
  ) {
    this.logger.setContext('CampaignService');
  }

  /**
   * Enforce admin-controlled feature gates for a campaign's type and options.
   * No-ops while every flag is enabled for every plan (Meta App Review mode).
   */
  private async assertCampaignFeaturesAllowed(
    userId: string,
    input: { type?: CampaignType; commentReplyEnabled?: boolean; followCheckEnabled?: boolean },
  ) {
    const sub = await this.subscriptionService.getOrCreate(userId);
    if (input.type) {
      await this.featureFlagService.assertEnabled(CAMPAIGN_TYPE_FLAG[input.type], sub.plan);
    }
    // Public comment auto-reply as an add-on option is covered by COMMENT_REPLY.
    if (input.commentReplyEnabled && input.type !== 'COMMENT_REPLY') {
      await this.featureFlagService.assertEnabled('COMMENT_REPLY', sub.plan);
    }
    if (input.followCheckEnabled) {
      await this.featureFlagService.assertEnabled('FOLLOW_CHECK_GATE', sub.plan);
    }
  }

  async create(userId: string, dto: CreateCampaignDto, opts?: { draftOnly?: boolean }) {
    // Key-authenticated callers can only stage drafts; activation happens
    // from a dashboard session, never from a scoped token alone.
    if (opts?.draftOnly) dto = { ...dto, status: CampaignStatus.PAUSED };

    // Idempotent create: a retry with the same clientRequestId returns the
    // original campaign instead of creating a duplicate.
    const requestHash = dto.clientRequestId
      ? hashIdempotentPayload({
          name: dto.name,
          instagramAccountId: dto.instagramAccountId,
          type: dto.type,
          replyMessage: dto.replyMessage,
        })
      : null;

    if (dto.clientRequestId) {
      const existing = await this.prisma.campaign.findFirst({
        where: { userId, clientRequestId: dto.clientRequestId, deletedAt: null },
        include: { keywords: true, posts: true },
      });
      if (existing) {
        // A retry must be the same operation: mismatched payload = conflict.
        if (existing.clientRequestHash && existing.clientRequestHash !== requestHash) {
          throw new ConflictException('clientRequestId was already used with a different payload');
        }
        return existing;
      }
    }

    // 1. Verify that the Instagram Account is connected to this user
    const account = await this.prisma.instagramAccount.findFirst({
      where: { id: dto.instagramAccountId, userId, deletedAt: null },
    });

    if (!account) {
      throw new NotFoundException('Connected Instagram account not found');
    }

    // 1b. Enforce per-plan feature gates for the campaign type and options
    await this.assertCampaignFeaturesAllowed(userId, {
      type: dto.type,
      commentReplyEnabled: dto.commentReplyEnabled,
      followCheckEnabled: dto.followCheckEnabled,
    });

    // 2. Verify keyword quota limits
    if (dto.keywords && dto.keywords.length > 0) {
      const { limits } = await this.subscriptionService.getLimits(userId);
      if (limits.max_keywords !== -1 && dto.keywords.length > limits.max_keywords) {
        throw new ForbiddenException(
          `Keyword limit exceeded. Your plan allows a maximum of ${limits.max_keywords} keywords per campaign.`,
        );
      }
    }

    // 2. Atomically verify the campaign quota and create the campaign inside a
    // serializable transaction so two concurrent creates cannot both pass a
    // check-then-create race. Postgres aborts the losing transaction (P2034),
    // which is retried once below.
    const createWithQuota = () =>
      this.prisma.$transaction(
        async (tx) => {
          const { limits } = await this.subscriptionService.getLimits(userId);
          if (limits.max_campaigns !== -1 && limits.max_campaigns > 0) {
            const current = await tx.campaign.count({ where: { userId, deletedAt: null } });
            if (current >= limits.max_campaigns) {
              throw new ForbiddenException(
                `Plan limit reached: max_campaigns (${current}/${limits.max_campaigns}). Upgrade your plan to continue.`,
              );
            }
          }

          return tx.campaign.create({
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
              clientRequestId: dto.clientRequestId || null,
              clientRequestHash: requestHash,
              status: dto.status ?? CampaignStatus.ACTIVE,
              keywords: dto.keywords
                ? {
                    create: normalizeKeywords(dto.keywords).map((k) => ({
                      keyword: k.keyword,
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
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

    let campaign;
    try {
      campaign = await createWithQuota();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        // Lost a serialization race against a concurrent create: retry once so
        // the quota check re-runs against the committed state.
        campaign = await createWithQuota();
      } else if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        dto.clientRequestId
      ) {
        // Concurrent duplicate: the unique constraint lost the race, so the
        // original row exists - return it instead of failing or duplicating.
        const existing = await this.prisma.campaign.findFirst({
          where: { userId, clientRequestId: dto.clientRequestId, deletedAt: null },
          include: { keywords: true, posts: true },
        });
        if (existing && existing.clientRequestHash === requestHash) return existing;
        if (existing)
          throw new ConflictException('clientRequestId was already used with a different payload');
        throw error;
      } else {
        throw error;
      }
    }

    await this.subscriptionService.incrementUsage(userId, 'max_campaigns', 1);

    await this.auditLogService.log({
      userId,
      action: 'CAMPAIGN_CREATE',
      details: JSON.stringify({ id: campaign.id, name: campaign.name }),
    });

    return campaign;
  }

  async findAll(
    userId: string,
    search?: string,
    status?: CampaignStatus,
    allowedAccountIds?: string[],
    accountId?: string,
  ) {
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        userId,
        deletedAt: null,
        // Restricted keys only ever see campaigns on their allowed accounts.
        ...(allowedAccountIds && allowedAccountIds.length > 0
          ? { instagramAccountId: { in: allowedAccountIds } }
          : {}),
        // Optional per-account picker. Scoped by userId above, so an account
        // the caller does not own simply matches nothing (fail-closed).
        ...(accountId ? { instagramAccountId: accountId } : {}),
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

    // Rebinding the campaign to another Instagram account requires the same
    // ownership proof as create: without it a campaign could be moved onto a
    // different user's account and fire automations with that account's token.
    if (dto.instagramAccountId) {
      const account = await this.prisma.instagramAccount.findFirst({
        where: { id: dto.instagramAccountId, userId, deletedAt: null },
      });
      if (!account) {
        throw new NotFoundException('Connected Instagram account not found');
      }
    }

    // Enforce per-plan feature gates for any gated fields being changed
    await this.assertCampaignFeaturesAllowed(userId, {
      type: dto.type ?? campaign.type,
      commentReplyEnabled: dto.commentReplyEnabled ?? campaign.commentReplyEnabled,
      followCheckEnabled: dto.followCheckEnabled ?? campaign.followCheckEnabled,
    });

    // Update core fields
    const updatedCampaign = await this.prisma.campaign.update({
      where: { id },
      data: {
        name: dto.name || undefined,
        description: dto.description || undefined,
        type: dto.type || undefined,
        instagramAccountId: dto.instagramAccountId || undefined,
        replyMessage: dto.replyMessage || undefined,
        // Absent fields are preserved; only an explicit value (including an
        // explicit empty string, which clears) changes stored content.
        replyMediaUrl: dto.replyMediaUrl === undefined ? undefined : dto.replyMediaUrl || null,
        commentReplyEnabled:
          dto.commentReplyEnabled !== undefined ? dto.commentReplyEnabled : undefined,
        commentReplyText:
          dto.commentReplyText === undefined ? undefined : dto.commentReplyText || null,
        followCheckEnabled:
          dto.followCheckEnabled !== undefined ? dto.followCheckEnabled : undefined,
      },
    });

    // Update keywords if provided
    if (dto.keywords) {
      const normalized = normalizeKeywords(dto.keywords);
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
      if (normalized.length > 0) {
        await this.prisma.keyword.createMany({
          data: normalized.map((kw) => ({
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

  async toggleStatus(userId: string, id: string, opts?: { draftOnly?: boolean }) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const nextStatus =
      campaign.status === CampaignStatus.ACTIVE ? CampaignStatus.PAUSED : CampaignStatus.ACTIVE;

    // Keys may pause an ACTIVE campaign (safe stop) but can never activate:
    // activation stays a dashboard-only action.
    if (opts?.draftOnly && nextStatus === CampaignStatus.ACTIVE) {
      throw new ForbiddenException(
        'API keys may pause campaigns only; activate campaigns from the dashboard',
      );
    }

    if (nextStatus === CampaignStatus.ACTIVE) {
      await this.assertCampaignFeaturesAllowed(userId, campaign);
    }

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
