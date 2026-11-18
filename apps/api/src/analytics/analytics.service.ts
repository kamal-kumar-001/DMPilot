import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MessageDirection, MessageStatus, CampaignStatus } from '@prisma/client';

export interface AnalyticsSummary {
  totalComments: number;
  /** Provider-accepted sends only (real provider message id, no placeholders). */
  totalDmsSent: number;
  /** Manual inbox sends still waiting on the queue (placeholder id, unresolved). */
  queuedDms: number;
  successRate: number;
  activeCampaigns: number;
  failedDms: number;
}

// A Message row only counts as provider-accepted once it carries a real
// provider message id. `manual_…` ids are placeholders pre-created when a
// manual inbox send is queued (still unresolved), and `mock_msg_…` ids come
// from the sandbox mock path — neither proves Instagram accepted anything.
const PROVIDER_ACCEPTED = {
  status: MessageStatus.SENT,
  NOT: [{ messageId: { startsWith: 'manual_' } }, { messageId: { startsWith: 'mock_msg_' } }],
};
const QUEUED_MANUAL = {
  status: MessageStatus.SENT,
  messageId: { startsWith: 'manual_' },
};

export interface ChartDataPoint {
  date: string;
  comments: number;
  messages: number;
}

export interface RatesData {
  sent: number;
  failed: number;
  pending: number;
  successRate: number;
  failureRate: number;
}

export interface TopPost {
  mediaId: string;
  totalComments: number;
  repliedComments: number;
}

export interface TopKeyword {
  keyword: string;
  matchingRule: string;
  campaignName: string;
  triggerCount: number;
}

export interface DailyUsage {
  date: string;
  comments: number;
  dmsSent: number;
  failedDms: number;
}

export interface CreatorUsageStat {
  userId: string;
  email: string;
  name: string | null;
  totalComments: number;
  totalDmsSent: number;
  activeCampaigns: number;
  connectedAccounts: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── helpers ──────────────────────────────────────────────────────
  private async resolveAccountIds(userId: string): Promise<string[]> {
    const accounts = await this.prisma.instagramAccount.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    return accounts.map((a) => a.id);
  }

  // ─── Summary ──────────────────────────────────────────────────────
  async getSummary(
    userId: string,
    allowedAccountIds?: string[],
    accountId?: string,
  ): Promise<AnalyticsSummary> {
    let accountIds = await this.resolveAccountIds(userId);
    // Restricted keys only aggregate over their allowed accounts.
    if (allowedAccountIds && allowedAccountIds.length > 0) {
      accountIds = accountIds.filter((id) => allowedAccountIds.includes(id));
    }
    // Optional per-account picker: silently narrows to nothing when the id is
    // not one of the caller's accounts (fail-closed, never widens).
    if (accountId) {
      accountIds = accountIds.filter((id) => id === accountId);
    }
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalComments, totalDmsSent, queuedDms, failedDms, activeCampaigns] = await Promise.all([
      this.prisma.comment.count({
        where: {
          instagramAccountId: { in: accountIds },
          createdAt: { gte: last24h },
        },
      }),
      this.prisma.message.count({
        where: {
          instagramAccountId: { in: accountIds },
          direction: MessageDirection.OUTGOING,
          ...PROVIDER_ACCEPTED,
          createdAt: { gte: last24h },
        },
      }),
      this.prisma.message.count({
        where: {
          instagramAccountId: { in: accountIds },
          direction: MessageDirection.OUTGOING,
          ...QUEUED_MANUAL,
          createdAt: { gte: last24h },
        },
      }),
      this.prisma.message.count({
        where: {
          instagramAccountId: { in: accountIds },
          direction: MessageDirection.OUTGOING,
          status: MessageStatus.FAILED,
          createdAt: { gte: last24h },
        },
      }),
      this.prisma.campaign.count({
        where: {
          userId,
          status: CampaignStatus.ACTIVE,
          deletedAt: null,
          instagramAccountId: { in: accountIds },
        },
      }),
    ]);

    // Success rate covers resolved sends only; queued rows are unresolved.
    const successRate =
      totalDmsSent + failedDms > 0
        ? Math.round((totalDmsSent / (totalDmsSent + failedDms)) * 100)
        : 0;

    return { totalComments, totalDmsSent, queuedDms, successRate, activeCampaigns, failedDms };
  }

  // ─── Rates breakdown ──────────────────────────────────────────────
  async getRates(userId: string): Promise<RatesData> {
    const accountIds = await this.resolveAccountIds(userId);
    const base = { instagramAccountId: { in: accountIds }, direction: MessageDirection.OUTGOING };

    const [sent, failed, pending] = await Promise.all([
      this.prisma.message.count({ where: { ...base, ...PROVIDER_ACCEPTED } }),
      this.prisma.message.count({ where: { ...base, status: MessageStatus.FAILED } }),
      this.prisma.message.count({ where: { ...base, ...QUEUED_MANUAL } }),
    ]);
    const total = sent + failed;
    return {
      sent,
      failed,
      pending,
      successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
      failureRate: total > 0 ? Math.round((failed / total) * 100) : 0,
    };
  }

  // ─── 7-day chart ──────────────────────────────────────────────────
  async getChartData(userId: string): Promise<ChartDataPoint[]> {
    const accountIds = await this.resolveAccountIds(userId);
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const result: ChartDataPoint[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const from = new Date(now);
      from.setDate(now.getDate() - i);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setHours(23, 59, 59, 999);

      const [comments, messages] = await Promise.all([
        this.prisma.comment.count({
          where: { instagramAccountId: { in: accountIds }, createdAt: { gte: from, lte: to } },
        }),
        this.prisma.message.count({
          where: {
            instagramAccountId: { in: accountIds },
            direction: MessageDirection.OUTGOING,
            ...PROVIDER_ACCEPTED,
            createdAt: { gte: from, lte: to },
          },
        }),
      ]);
      result.push({ date: DAY_LABELS[from.getDay()], comments, messages });
    }
    return result;
  }

  // ─── Daily usage (30 days) ────────────────────────────────────────
  async getDailyUsage(userId: string, days = 30, accountId?: string): Promise<DailyUsage[]> {
    let accountIds = await this.resolveAccountIds(userId);
    // Optional per-account picker (fail-closed: an id the caller does not own
    // narrows to an empty set, never widens).
    if (accountId) {
      accountIds = accountIds.filter((id) => id === accountId);
    }
    const result: DailyUsage[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const from = new Date(now);
      from.setDate(now.getDate() - i);
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setHours(23, 59, 59, 999);

      const base = { instagramAccountId: { in: accountIds }, createdAt: { gte: from, lte: to } };
      const [comments, dmsSent, failedDms] = await Promise.all([
        this.prisma.comment.count({ where: base }),
        this.prisma.message.count({
          where: { ...base, direction: MessageDirection.OUTGOING, ...PROVIDER_ACCEPTED },
        }),
        this.prisma.message.count({
          where: { ...base, direction: MessageDirection.OUTGOING, status: MessageStatus.FAILED },
        }),
      ]);
      result.push({ date: from.toISOString().slice(0, 10), comments, dmsSent, failedDms });
    }
    return result;
  }

  // ─── Top Posts ────────────────────────────────────────────────────
  async getTopPosts(userId: string, limit = 10): Promise<TopPost[]> {
    const accountIds = await this.resolveAccountIds(userId);

    const groups = await this.prisma.comment.groupBy({
      by: ['mediaId'],
      where: { instagramAccountId: { in: accountIds } },
      _count: { mediaId: true },
      orderBy: { _count: { mediaId: 'desc' } },
      take: limit,
    });

    const posts: TopPost[] = await Promise.all(
      groups.map(async (g) => {
        const repliedCount = await this.prisma.comment.count({
          where: { instagramAccountId: { in: accountIds }, mediaId: g.mediaId, isReplied: true },
        });
        return {
          mediaId: g.mediaId,
          totalComments: g._count.mediaId,
          repliedComments: repliedCount,
        };
      }),
    );
    return posts;
  }

  // ─── Top Keywords ─────────────────────────────────────────────────
  async getTopKeywords(userId: string, limit = 10): Promise<TopKeyword[]> {
    // Find all keywords from user's campaigns, join with comment trigger count
    const keywords = await this.prisma.keyword.findMany({
      where: { campaign: { userId, deletedAt: null } },
      include: { campaign: { select: { name: true, instagramAccountId: true } } },
      take: 100,
    });

    const enriched: TopKeyword[] = await Promise.all(
      keywords.map(async (kw) => {
        // Count comments that contain this keyword (approximation via text contains)
        const count = await this.prisma.comment.count({
          where: {
            instagramAccountId: kw.campaign.instagramAccountId,
            text: { contains: kw.keyword, mode: 'insensitive' },
            isReplied: true,
          },
        });
        return {
          keyword: kw.keyword,
          matchingRule: kw.matchingRule,
          campaignName: kw.campaign.name,
          triggerCount: count,
        };
      }),
    );

    return enriched.sort((a, b) => b.triggerCount - a.triggerCount).slice(0, limit);
  }

  // ─── Recent activity ──────────────────────────────────────────────
  async getRecentActivity(userId: string, limit = 10) {
    const accountIds = await this.resolveAccountIds(userId);
    if (accountIds.length === 0) return [];

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const [recentComments, recentMessages] = await Promise.all([
        this.prisma.comment.findMany({
          where: {
            instagramAccountId: { in: accountIds },
            createdAt: { gte: last24h },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: { commentId: true, username: true, text: true, isReplied: true, createdAt: true },
        }),
        this.prisma.message.findMany({
          where: {
            instagramAccountId: { in: accountIds },
            direction: MessageDirection.OUTGOING,
            createdAt: { gte: last24h },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          select: { messageId: true, recipientId: true, text: true, status: true, createdAt: true },
        }),
      ]);

      // Resolve recipient usernames for outgoing DMs using Comment table
      const recipientIds = recentMessages.map((m) => m.recipientId);
      const comments = await this.prisma.comment.findMany({
        where: { userId: { in: recipientIds } },
        select: { userId: true, username: true },
      });
      const usernameMap = new Map<string, string>();
      for (const c of comments) {
        usernameMap.set(c.userId, c.username);
      }

      const activity = [
        ...recentComments.map((c) => ({
          type: 'comment' as const,
          id: c.commentId,
          label: `@${c.username} commented`,
          detail: c.text.slice(0, 60),
          success: c.isReplied,
          ts: c.createdAt,
        })),
        ...recentMessages.map((m) => {
          const username = usernameMap.get(m.recipientId);
          return {
            type: 'dm' as const,
            id: m.messageId,
            label: username ? `DM sent to @${username}` : `DM sent to ${m.recipientId}`,
            detail: (m.text ?? '').slice(0, 60),
            // Queued manual sends (manual_… placeholder) and sandbox mock
            // sends are not successes: nobody accepted them yet / at all.
            success:
              m.status === MessageStatus.SENT &&
              !m.messageId.startsWith('manual_') &&
              !m.messageId.startsWith('mock_msg_'),
            ts: m.createdAt,
          };
        }),
      ]
        .sort((a, b) => b.ts.getTime() - a.ts.getTime())
        .slice(0, limit);

      return activity;
    } catch (e) {
      this.logger.warn(
        `Failed to fetch recent activity for user ${userId}: ${e instanceof Error ? e.message : e}`,
      );
      return [];
    }
  }

  // ─── Admin: Creator usage stats ────────────────────────────────────
  async getCreatorUsageStats(
    page = 1,
    limit = 20,
  ): Promise<{ data: CreatorUsageStat[]; total: number }> {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          instagramAccounts: { select: { id: true }, where: { deletedAt: null } },
          campaigns: {
            select: { id: true },
            where: { deletedAt: null, status: CampaignStatus.ACTIVE },
          },
        },
      }),
      this.prisma.user.count(),
    ]);

    const data: CreatorUsageStat[] = await Promise.all(
      users.map(async (u) => {
        const accountIds = u.instagramAccounts.map((a) => a.id);
        const [totalComments, totalDmsSent] = await Promise.all([
          this.prisma.comment.count({ where: { instagramAccountId: { in: accountIds } } }),
          this.prisma.message.count({
            where: {
              instagramAccountId: { in: accountIds },
              direction: MessageDirection.OUTGOING,
              status: MessageStatus.SENT,
            },
          }),
        ]);
        return {
          userId: u.id,
          email: u.email,
          name: u.name,
          totalComments,
          totalDmsSent,
          activeCampaigns: u.campaigns.length,
          connectedAccounts: u.instagramAccounts.length,
        };
      }),
    );

    return { data, total };
  }

  async getFollowerStats(userId: string) {
    const account = await this.prisma.instagramAccount.findFirst({
      where: { userId, deletedAt: null, isConnected: true },
    });

    if (!account) {
      return {
        currentFollowers: 0,
        followersGrowth30d: 0,
        followersGrowthPercent30d: 0,
        dailyHistory: [],
      };
    }

    // Reads must never invent follower history or write analytics data.
    // Sparse history stays sparse until real observations are recorded.
    // 2. Fetch history
    const history = await this.prisma.followerHistory.findMany({
      where: { instagramAccountId: account.id },
      orderBy: { date: 'asc' },
    });

    if (history.length === 0) {
      return {
        currentFollowers: account.followersCount,
        followersGrowth30d: 0,
        followersGrowthPercent30d: 0,
        dailyHistory: [],
      };
    }

    const firstCount = history[0].followerCount;
    const lastCount = history[history.length - 1].followerCount;
    const followersGrowth30d = lastCount - firstCount;
    const followersGrowthPercent30d =
      firstCount > 0 ? Math.round((followersGrowth30d / firstCount) * 1000) / 10 : 0;

    const dailyHistory = history.map((item, idx) => {
      // First recorded point has no earlier observation: change is 0, never
      // a fabricated delta.
      const prevCount = idx > 0 ? history[idx - 1].followerCount : item.followerCount;
      return {
        date: item.date.toISOString().split('T')[0],
        followerCount: item.followerCount,
        change: item.followerCount - prevCount,
      };
    });

    return {
      currentFollowers: account.followersCount,
      followersGrowth30d,
      followersGrowthPercent30d,
      dailyHistory,
    };
  }
}
