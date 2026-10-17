import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { totalmem } from 'os';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_NAMES } from '../queue/constants';

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface FailedJob {
  id: string;
  queue: string;
  name: string;
  data: unknown;
  failedReason: string;
  attemptsMade: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}

export interface SystemMetrics {
  uptimeSeconds: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  memoryPercent: number;
  nodeVersion: string;
  pid: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  api: boolean;
  database: boolean;
  redis: boolean;
  checkedAt: string;
}

@Injectable()
export class MonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.INSTAGRAM_MEDIA_FETCH) private readonly mediaFetchQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SEND_DM) private readonly sendDmQueue: Queue,
  ) {}

  // ──────────────── Health ────────────────

  async getHealth(): Promise<HealthStatus> {
    let database = false;
    let redis = false;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }

    try {
      const client = (this.sendDmQueue as any).opts?.connection;
      // Ping via BullMQ's internal client
      await this.sendDmQueue.getJobCounts('waiting');
      redis = true;
    } catch {
      redis = false;
    }

    const allHealthy = database && redis;
    const anyDown = !database || !redis;

    return {
      api: true,
      database,
      redis,
      status: allHealthy ? 'healthy' : anyDown ? 'degraded' : 'down',
      checkedAt: new Date().toISOString(),
    };
  }

  // ──────────────── Queue Stats ────────────────

  async getQueueStats(): Promise<QueueStats[]> {
    const queues = [
      { queue: this.mediaFetchQueue, name: QUEUE_NAMES.INSTAGRAM_MEDIA_FETCH },
      { queue: this.sendDmQueue, name: QUEUE_NAMES.SEND_DM },
    ];

    return Promise.all(
      queues.map(async ({ queue, name }) => {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);
        const isPaused = await queue.isPaused();
        return { name, waiting, active, completed, failed, delayed, paused: isPaused };
      }),
    );
  }

  // ──────────────── Failed Jobs ────────────────

  async getFailedJobs(limit = 50): Promise<FailedJob[]> {
    const queues = [
      { queue: this.mediaFetchQueue, name: QUEUE_NAMES.INSTAGRAM_MEDIA_FETCH },
      { queue: this.sendDmQueue, name: QUEUE_NAMES.SEND_DM },
    ];

    const results: FailedJob[] = [];

    for (const { queue, name } of queues) {
      const jobs = await queue.getFailed(0, limit - 1);
      for (const job of jobs) {
        results.push({
          id: String(job.id),
          queue: name,
          name: job.name,
          data: job.data,
          failedReason: job.failedReason ?? 'Unknown error',
          attemptsMade: job.attemptsMade,
          timestamp: job.timestamp,
          processedOn: job.processedOn ?? undefined,
          finishedOn: job.finishedOn ?? undefined,
        });
      }
    }

    // Also fetch failed jobs stored in QueueJob database table
    const dbFailedJobs = await this.prisma.queueJob
      .findMany({
        where: { status: 'FAILED' },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      .catch(() => []);

    for (const dbJob of dbFailedJobs) {
      if (!results.some((r) => r.id === dbJob.id)) {
        results.push({
          id: dbJob.id,
          queue: 'send_dm_queue',
          name: dbJob.name || 'send_dm',
          data: dbJob.payload || {},
          failedReason: dbJob.error || 'Processing failed',
          attemptsMade: dbJob.attempts || 1,
          timestamp: new Date(dbJob.createdAt).getTime(),
          finishedOn: dbJob.finishedAt
            ? new Date(dbJob.finishedAt).getTime()
            : new Date(dbJob.updatedAt).getTime(),
        });
      }
    }

    return results.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  }

  async retryFailedJob(queueName: string, jobId: string): Promise<{ retried: boolean }> {
    const queueMap: Record<string, Queue> = {
      [QUEUE_NAMES.INSTAGRAM_MEDIA_FETCH]: this.mediaFetchQueue,
      [QUEUE_NAMES.SEND_DM]: this.sendDmQueue,
    };

    const queue = queueMap[queueName];
    if (!queue) return { retried: false };

    const job = await queue.getJob(jobId);
    if (!job) return { retried: false };

    await job.retry();
    return { retried: true };
  }

  async purgeFailedJobs(olderThan?: string): Promise<{ count: number; timeframe: string }> {
    const queues = [this.mediaFetchQueue, this.sendDmQueue];
    let purgedCount = 0;

    let cutoffMs = 0;
    if (olderThan === '24h' || olderThan === '1d') {
      cutoffMs = 24 * 60 * 60 * 1000;
    } else if (olderThan === '7d') {
      cutoffMs = 7 * 24 * 60 * 60 * 1000;
    } else if (olderThan === '30d') {
      cutoffMs = 30 * 24 * 60 * 60 * 1000;
    }

    const now = Date.now();

    for (const queue of queues) {
      const jobs = await queue.getFailed(0, 1000);
      for (const job of jobs) {
        const jobAge = now - job.timestamp;
        if (cutoffMs === 0 || jobAge > cutoffMs) {
          await job.remove().catch(() => null);
          purgedCount++;
        }
      }
    }

    // Also purge failed QueueJob records from database
    const dbWhereClause: any = { status: 'FAILED' };
    if (cutoffMs > 0) {
      const cutoffDate = new Date(now - cutoffMs);
      dbWhereClause.createdAt = { lt: cutoffDate };
    }

    const dbResult = await this.prisma.queueJob
      .deleteMany({ where: dbWhereClause })
      .catch(() => ({ count: 0 }));
    purgedCount += dbResult.count;

    return { count: purgedCount, timeframe: olderThan || 'all' };
  }

  // ──────────────── Webhook Logs ────────────────

  async getWebhookLogs(userId?: string, isStaff = false, page = 1, limit = 50) {
    let whereClause: any = {};

    if (!isStaff && userId) {
      const userAccounts = await this.prisma.instagramAccount.findMany({
        where: { userId, deletedAt: null },
        select: { instagramId: true, instagramPageId: true, username: true },
      });

      if (userAccounts.length === 0) {
        return { logs: [], total: 0, page, limit };
      }

      const allowedIds = userAccounts.flatMap(
        (a) => [a.instagramId, a.instagramPageId].filter(Boolean) as string[],
      );
      const allowedUsernames = userAccounts.map((a) => a.username).filter(Boolean);

      whereClause = {
        OR: [{ senderId: { in: allowedIds } }, { username: { in: allowedUsernames } }],
      };
    }

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.webhookEvent.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          eventId: true,
          provider: true,
          commentId: true,
          username: true,
          senderId: true,
          status: true,
          errorMessage: true,
          fbtraceId: true,
          payload: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.webhookEvent.count({ where: whereClause }),
    ]);
    return { logs, total, page, limit };
  }

  async getDeliveryLogs(userId?: string, isStaff = false, page = 1, limit = 50) {
    let accountIds: string[] = [];

    if (!isStaff && userId) {
      const userAccounts = await this.prisma.instagramAccount.findMany({
        where: { userId, deletedAt: null },
        select: { id: true },
      });
      accountIds = userAccounts.map((a) => a.id);
      if (accountIds.length === 0) {
        return { logs: [], total: 0, page, limit };
      }
    } else {
      const allAccounts = await this.prisma.instagramAccount.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      accountIds = allAccounts.map((a) => a.id);
    }

    const whereClause: any =
      accountIds.length > 0 ? { instagramAccountId: { in: accountIds } } : {};
    const skip = (page - 1) * limit;

    const [comments, totalComments, incomingMessages] = await Promise.all([
      this.prisma.comment.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: limit * 2,
        include: {
          campaign: {
            select: {
              name: true,
              type: true,
              replyMessage: true,
              keywords: { select: { keyword: true } },
            },
          },
        },
      }),
      this.prisma.comment.count({ where: whereClause }),
      this.prisma.message.findMany({
        where: {
          direction: 'INCOMING',
          ...(accountIds.length > 0 ? { instagramAccountId: { in: accountIds } } : {}),
          OR: [
            { campaignId: { not: null } },
            { mediaUrl: { not: null } },
            { text: { contains: 'Shared Post' } },
            { text: { contains: 'Shared a post' } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: limit * 2,
        include: {
          campaign: {
            select: {
              name: true,
              type: true,
              replyMessage: true,
              keywords: { select: { keyword: true } },
            },
          },
        },
      }),
    ]);

    // Format Comments into DeliveryEvent items
    const commentLogs = await Promise.all(
      comments.map(async (c) => {
        const matchingMsg = await this.prisma.message.findFirst({
          where: {
            instagramAccountId: c.instagramAccountId,
            recipientId: c.userId,
          },
          orderBy: { createdAt: 'desc' },
          select: { text: true, status: true, fbtraceId: true },
        });

        let status = 'DELIVERED';
        let dispatchStatus = 'got the DM.';
        if (!c.isReplied && (!c.replyText || c.replyText.includes('No campaign matched'))) {
          status = 'NO_MATCH';
          dispatchStatus = 'commented without a matching keyword, nothing to send.';
        } else if (c.replyText && c.replyText.includes('Failed:')) {
          status = 'FAILED';
          dispatchStatus = `delivery failed (${c.replyText.replace('Failed:', '').trim()}).`;
        }

        return {
          id: c.id,
          commentId: c.commentId,
          commenterUsername: `@${c.username.replace(/^@/, '')}`,
          commentText: c.text,
          mediaId: c.mediaId,
          status,
          dispatchStatus,
          campaignName: c.campaign?.name || 'Automated Campaign',
          matchedKeyword: c.campaign?.keywords?.[0]?.keyword || 'Matched',
          deliveredDmText:
            matchingMsg?.text || c.campaign?.replyMessage || c.replyText || 'Campaign DM enqueued',
          fbtraceId: matchingMsg?.fbtraceId || null,
          createdAt: c.createdAt,
        };
      }),
    );

    // Format Incoming DM Shares into DeliveryEvent items
    const messageLogs = await Promise.all(
      incomingMessages.map(async (m) => {
        const matchingMsg = await this.prisma.message.findFirst({
          where: {
            instagramAccountId: m.instagramAccountId,
            recipientId: m.senderId,
            direction: 'OUTGOING',
            ...(m.campaignId ? { campaignId: m.campaignId } : {}),
          },
          orderBy: { createdAt: 'desc' },
          select: { text: true, status: true, fbtraceId: true, errorMessage: true },
        });

        const commentAuthor = await this.prisma.comment.findFirst({
          where: { userId: m.senderId },
          select: { username: true },
        });

        const commenterUsername = commentAuthor?.username
          ? `@${commentAuthor.username.replace(/^@/, '')}`
          : `@ig_user_${m.senderId.slice(-4)}`;

        let status = 'DELIVERED';
        let dispatchStatus = 'got the DM via Share to DM.';

        if (!m.campaignId) {
          status = 'NO_MATCH';
          dispatchStatus = 'shared a post without a matching campaign, nothing to send.';
        } else if (matchingMsg?.status === 'FAILED') {
          status = 'FAILED';
          dispatchStatus = matchingMsg.errorMessage
            ? `delivery failed (${matchingMsg.errorMessage}).`
            : 'delivery failed.';
        }

        let mediaId = 'Share to DM';
        if (m.text) {
          const match =
            m.text.match(/\/p\/([a-zA-Z0-9_-]+)/) ||
            m.text.match(/\/reel\/([a-zA-Z0-9_-]+)/) ||
            m.text.match(/([0-9]{10,})/);
          if (match) mediaId = match[1];
        }

        return {
          id: m.id,
          commentId: m.messageId,
          commenterUsername,
          commentText: m.text || '📎 Shared a post or Reel to DM',
          mediaId,
          status,
          dispatchStatus,
          campaignName: m.campaign?.name || 'Share to DM Automation',
          matchedKeyword:
            m.campaign?.keywords?.[0]?.keyword ||
            (m.campaign?.type === 'SHARE_TO_DM' ? 'Shared Reel/Post' : 'Matched'),
          deliveredDmText: matchingMsg?.text || m.campaign?.replyMessage || 'Campaign DM enqueued',
          fbtraceId: matchingMsg?.fbtraceId || m.fbtraceId || null,
          createdAt: m.createdAt,
        };
      }),
    );

    const combined = [...commentLogs, ...messageLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const pagedLogs = combined.slice(skip, skip + limit);
    const total = totalComments + incomingMessages.length;

    return { logs: pagedLogs, total, page, limit };
  }

  // ──────────────── System Metrics ────────────────

  getSystemMetrics(): SystemMetrics {
    const mem = process.memoryUsage();
    const totalMem = totalmem();
    const usedMB = Math.round(mem.rss / 1024 / 1024);
    const totalMB = Math.round(totalMem / 1024 / 1024);

    return {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsedMB: usedMB,
      memoryTotalMB: totalMB,
      memoryPercent: Math.round((usedMB / totalMB) * 100),
      nodeVersion: process.version,
      pid: process.pid,
    };
  }

  async getWebhookStatus() {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'webhook_processing_paused' },
    });
    return { paused: setting?.value === 'true' };
  }

  async updateWebhookStatus(paused: boolean) {
    await this.prisma.systemSetting.upsert({
      where: { key: 'webhook_processing_paused' },
      update: { value: String(paused) },
      create: { key: 'webhook_processing_paused', value: String(paused) },
    });
    return { success: true, paused };
  }

  async purgeWebhookLogs(olderThan?: string) {
    let whereClause = {};

    if (olderThan === '24h' || olderThan === '1d') {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      whereClause = { createdAt: { lt: cutoff } };
    } else if (olderThan === '7d') {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      whereClause = { createdAt: { lt: cutoff } };
    } else if (olderThan === '30d') {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      whereClause = { createdAt: { lt: cutoff } };
    }

    const result = await this.prisma.webhookEvent.deleteMany({ where: whereClause });
    return { count: result.count, timeframe: olderThan || 'all' };
  }
}
