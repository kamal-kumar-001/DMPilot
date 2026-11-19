import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagService } from '../billing/feature-flag.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { AuditLogService } from '../auth/audit-log.service';
import { UserRole, CampaignStatus, Plan } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlagService: FeatureFlagService,
    private readonly monitoringService: MonitoringService,
    private readonly auditLogService: AuditLogService,
    private readonly configService?: ConfigService,
  ) {}

  // ─── Deploy requests (safe update control) ───────────────────────
  // Owner-only exact-commit deploy requests; the host watcher only claims
  // and reports. No arbitrary commands, no fail-open stale reclaim, forced
  // audit entries so deploy history survives an audit_logging pause.
  private static readonly DEPLOY_ACTIVE_STATUSES = ['REQUESTED', 'CLAIMED', 'RUNNING'];

  /**
   * Secret scrubbing for watcher-reported text before it is stored. Covers
   * API keys, credentialed connection URLs, bearer headers and common
   * provider token shapes; the watcher script applies the same rules.
   */
  static redactDeployText(t?: string): string {
    return (t || '')
      .replace(/dmp_live_[A-Za-z0-9]+/g, '[redacted]')
      .replace(
        /(postgres(ql)?|mysql|mariadb|mongodb(\+srv)?|redis):\/\/[^\s"']+/gi,
        '[redacted-db-url]',
      )
      .replace(/bearer [A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
      .replace(/(sk|pk|rk)_(live|test|prod)_[A-Za-z0-9]+/g, '[redacted]')
      .replace(/(password|passwd|pwd)=[^\s&"']+/gi, '$1=[redacted]')
      .replace(/(x-api-key|authorization)\s*[:=]\s*[^\s"',}]+/gi, '$1: [redacted]')
      .slice(0, 8000);
  }
  private static readonly DEPLOY_EXPIRY_MS = 30 * 60 * 1000;

  private deployOwnerId(): string {
    const id = String(
      this.configService?.get('DEPLOY_OWNER_USER_ID') || process.env.DEPLOY_OWNER_USER_ID || '',
    );
    if (!id)
      throw new ForbiddenException(
        'Deploy requests are disabled: DEPLOY_OWNER_USER_ID is not configured.',
      );
    return id;
  }

  private async auditDeploy(action: string, details: Record<string, unknown>) {
    await this.auditLogService.log({ action, details: JSON.stringify(details) }, { force: true });
  }

  private async expireStaleRequests() {
    await this.prisma.deployRequest.updateMany({
      where: {
        status: 'REQUESTED',
        createdAt: { lt: new Date(Date.now() - AdminService.DEPLOY_EXPIRY_MS) },
      },
      data: { status: 'EXPIRED', finishedAt: new Date() },
    });
  }

  private latestMainCache?: { sha: string; checkedAt: string; until: number };
  private latestMainPending?: Promise<{ sha: string; checkedAt: string }>;

  async getLatestDeployCommit() {
    if (this.latestMainCache && this.latestMainCache.until > Date.now()) {
      const { sha, checkedAt } = this.latestMainCache;
      return { sha, checkedAt, repository: 'kamal-kumar-001/DMPilot', branch: 'main' };
    }
    if (!this.latestMainPending) {
      this.latestMainPending = (async () => {
        try {
          // Fixed public repository only. No shell, credentials, user-supplied URL or execution.
          const response = await fetch(
            'https://api.github.com/repos/kamal-kumar-001/DMPilot/commits/main',
            {
              headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'DMPilot-admin' },
              signal: AbortSignal.timeout(5000),
              redirect: 'error',
            },
          );
          if (!response.ok) throw new Error('Repository lookup failed');
          const body = (await response.json()) as { sha?: unknown };
          if (typeof body.sha !== 'string' || !/^[0-9a-f]{40}$/.test(body.sha))
            throw new Error('Invalid commit');
          const result = { sha: body.sha, checkedAt: new Date().toISOString() };
          this.latestMainCache = { ...result, until: Date.now() + 60_000 };
          return result;
        } catch {
          throw new ServiceUnavailableException(
            'Latest main commit is unavailable. Retry or enter a verified full commit ID.',
          );
        } finally {
          this.latestMainPending = undefined;
        }
      })();
    }
    return {
      ...(await this.latestMainPending),
      repository: 'kamal-kumar-001/DMPilot',
      branch: 'main',
    };
  }

  async createDeployRequest(userId: string, targetSha: string, confirm: string) {
    if (confirm !== 'DEPLOY') {
      throw new BadRequestException(
        'Typed confirmation required: pass confirm = "DEPLOY" to request a deploy.',
      );
    }
    if (!/^[0-9a-f]{40}$/.test(targetSha || '')) {
      throw new BadRequestException('targetSha must be a full 40-character commit SHA.');
    }
    if (userId !== this.deployOwnerId()) {
      throw new ForbiddenException('Only the owner admin account can request deploys.');
    }
    await this.expireStaleRequests();
    const req = await this.serializableDeployTx(async (tx) => {
      const active = await tx.deployRequest.count({
        where: { status: { in: AdminService.DEPLOY_ACTIVE_STATUSES } },
      });
      if (active > 0) {
        throw new ConflictException(
          'A deploy request is already active. Wait for it to finish or cancel it.',
        );
      }
      return tx.deployRequest.create({ data: { targetSha, createdById: userId } });
    }, 'A deploy request is already active. Wait for it to finish or cancel it.');
    await this.auditDeploy('ADMIN_DEPLOY_REQUEST', {
      requestId: req.id,
      targetSha,
      createdById: userId,
    });
    return req;
  }

  async listDeployRequests() {
    await this.expireStaleRequests();
    return this.prisma.deployRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
  }

  async cancelDeployRequest(userId: string, requestId: string) {
    if (userId !== this.deployOwnerId()) {
      throw new ForbiddenException('Only the owner admin account can cancel deploy requests.');
    }
    const req = await this.prisma.deployRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Deploy request not found.');
    if (req.status === 'RUNNING' || req.status === 'CLAIMED') {
      // No fail-open: a live host run may hold this runId. Reconcile via the
      // watcher (or stop the host run) instead of marking stale here.
      throw new ConflictException(
        'Request is claimed/running on the host; reconcile or stop the host run first.',
      );
    }
    if (req.status !== 'REQUESTED' && req.status !== 'AWAITING_APPROVAL') {
      throw new BadRequestException(`Request is already ${req.status}.`);
    }
    const updated = await this.prisma.deployRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELED', finishedAt: new Date() },
    });
    await this.auditDeploy('ADMIN_DEPLOY_CANCEL', { requestId, createdById: userId });
    return updated;
  }

  /**
   * Serializable transaction wrapper for deploy state transitions: the
   * single-active invariant must hold under truly concurrent callers, not
   * just sequential ones. A serialization loser is retried (it then sees
   * the winner's row and gets the domain conflict); repeated contention
   * maps to the same conflict instead of an opaque 500.
   */
  private async serializableDeployTx<T>(
    fn: (tx: any) => Promise<T>,
    conflictMessage: string,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(fn, { isolationLevel: 'Serializable' });
      } catch (e: any) {
        if (e?.code === 'P2034' && attempt < 2) continue;
        if (e?.code === 'P2034') throw new ConflictException(conflictMessage);
        throw e;
      }
    }
  }

  // Watcher-facing (deploy-scoped API key only; enforced in controller).
  async claimNextDeployRequest() {
    await this.expireStaleRequests();
    return this.serializableDeployTx(async (tx) => {
      const active = await tx.deployRequest.findFirst({
        where: { status: { in: ['CLAIMED', 'RUNNING'] } },
      });
      if (active) throw new ConflictException('A deploy run is already active on the host.');
      const next = await tx.deployRequest.findFirst({
        where: { status: 'REQUESTED' },
        orderBy: { createdAt: 'asc' },
      });
      if (!next) return null;
      if (next.createdById !== this.deployOwnerId()) {
        throw new ForbiddenException('Request was not created by the owner admin account.');
      }
      return tx.deployRequest.update({
        where: { id: next.id },
        data: { status: 'CLAIMED', claimedAt: new Date(), runId: randomUUID() },
      });
    }, 'A deploy run is already active on the host.');
  }

  async getActiveDeployRequest() {
    await this.expireStaleRequests();
    return this.prisma.deployRequest.findFirst({
      where: { status: { in: ['CLAIMED', 'RUNNING'] } },
    });
  }

  async reportDeployRequest(
    requestId: string,
    runId: string,
    body: { action: string; failureReason?: string; logTail?: string },
  ) {
    const req = await this.prisma.deployRequest.findUnique({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Deploy request not found.');
    if (!runId || req.runId !== runId) {
      throw new ForbiddenException('runId does not match the active run for this request.');
    }
    const redact = (t?: string) => AdminService.redactDeployText(t);
    let next: string | null = null;
    if (body.action === 'START' && req.status === 'CLAIMED') next = 'RUNNING';
    if (body.action === 'SUCCESS' && req.status === 'RUNNING') next = 'SUCCEEDED';
    if (
      (body.action === 'FAIL' || body.action === 'RECONCILE_FAILED') &&
      (req.status === 'RUNNING' || req.status === 'CLAIMED')
    )
      next = 'FAILED';
    if (body.action === 'AWAIT_APPROVAL' && req.status === 'RUNNING') next = 'AWAITING_APPROVAL';
    if (!next) {
      throw new BadRequestException(
        `Invalid report action ${body.action} for request in status ${req.status}.`,
      );
    }
    const finished = next !== 'RUNNING';
    const updated = await this.prisma.deployRequest.update({
      where: { id: requestId },
      data: {
        status: next,
        failureReason:
          redact(body.failureReason) ||
          (body.action === 'RECONCILE_FAILED' ? 'stale run reconciled' : null),
        logTail: redact(body.logTail) || undefined,
        finishedAt: finished ? new Date() : undefined,
      },
    });
    await this.auditDeploy('DEPLOY_RUN_REPORT', { requestId, runId, action: body.action, next });
    return updated;
  }

  // ─── Creators ────────────────────────────────────────────────────
  async getCreators(opts: { page: number; limit: number; search?: string; suspended?: boolean }) {
    const { page, limit, search } = opts;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isVerified: true,
          createdAt: true,
          subscription: { select: { plan: true, status: true } },
          _count: {
            select: {
              campaigns: true,
              instagramAccounts: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, total, page, limit };
  }

  async suspendUser(userId: string) {
    // Soft-suspension: set role to CREATOR (no effect) or use a dedicated field
    // For now archive all active campaigns and mark as suspended via AuditLog
    await this.prisma.campaign.updateMany({
      where: { userId, status: CampaignStatus.ACTIVE },
      data: { status: CampaignStatus.PAUSED },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: 'ADMIN_SUSPEND', details: `User ${userId} suspended by admin` },
    });
    return { suspended: true, userId };
  }

  async unsuspendUser(userId: string) {
    await this.prisma.auditLog.create({
      data: { userId, action: 'ADMIN_UNSUSPEND', details: `User ${userId} unsuspended by admin` },
    });
    return { unsuspended: true, userId };
  }

  async deleteCreator(userId: string, confirmEmail?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        campaigns: { select: { id: true } },
        instagramAccounts: { select: { id: true, instagramId: true } },
      },
    });

    if (!user) {
      throw new BadRequestException(`Creator with ID ${userId} not found`);
    }

    if (
      confirmEmail === undefined ||
      confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()
    ) {
      throw new BadRequestException(
        'Typed confirmation mismatch: pass confirmEmail equal to the creator email to delete this account.',
      );
    }

    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot delete an administrator account');
    }

    // Cascade delete user and all associated campaigns, posts, keywords,
    // instagram accounts, messages, comments, subscriptions, etc.
    await this.prisma.user.delete({
      where: { id: userId },
    });

    await this.auditLogService.log({
      action: 'ADMIN_DELETE_CREATOR',
      details: JSON.stringify({
        userId,
        email: user.email,
        campaignsDeleted: user.campaigns.length,
        accountsDeleted: user.instagramAccounts.length,
      }),
    });

    return {
      success: true,
      userId,
      message: 'Creator and all associated campaigns and data have been permanently deleted',
    };
  }

  async changePlan(userId: string, plan: Plan) {
    await this.prisma.subscription.upsert({
      where: { userId },
      create: { userId, plan, status: 'ACTIVE' },
      update: { plan, status: 'ACTIVE' },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: 'ADMIN_PLAN_CHANGE', details: `Plan changed to ${plan}` },
    });
    return { userId, plan };
  }

  // ─── Audit Logs ──────────────────────────────────────────────────
  async getAuditLogs(opts: { page: number; limit: number; userId?: string; action?: string }) {
    const { page, limit, userId, action } = opts;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (userId) where.userId = userId;
    if (action) where.action = { contains: action, mode: 'insensitive' };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, name: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data: logs, total, page, limit };
  }

  async purgeAuditLogs(opts: { all?: boolean; before?: string; confirm: string }) {
    if (opts.confirm !== 'PURGE') {
      throw new BadRequestException(
        'Typed confirmation required: pass confirm = "PURGE" to permanently delete audit logs.',
      );
    }

    let where: any = {};
    let label = 'all time';
    if (!opts.all) {
      const date = new Date(opts.before || '');
      if (isNaN(date.getTime())) {
        throw new BadRequestException('Invalid date format for "before"');
      }
      if (date.getTime() > Date.now()) {
        throw new BadRequestException(
          'Refusing purge: "before" is in the future, which would delete the entire history. Pass all = true with confirm = "PURGE" to purge everything.',
        );
      }
      where = { createdAt: { lt: date } };
      label = `older than ${date.toISOString()}`;
    }

    const result = await this.prisma.auditLog.deleteMany({ where });

    await this.auditLogService.log(
      {
        action: 'ADMIN_AUDIT_LOG_PURGE',
        details: JSON.stringify({ purgedCount: result.count, timeframe: label }),
      },
      { force: true },
    );

    return { count: result.count };
  }

  async deleteAuditLogs(olderThan: string) {
    const date = new Date(olderThan);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date format');
    }

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: date,
        },
      },
    });

    return { count: result.count };
  }

  async getAllAuditLogs(opts: { userId?: string; action?: string }) {
    const { userId, action } = opts;
    const where: any = {};
    if (userId) where.userId = userId;
    if (action) where.action = { contains: action, mode: 'insensitive' };

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { email: true, name: true } } },
    });
  }

  async getDeleteRequests(opts: { page: number; limit: number }) {
    const { page, limit } = opts;
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      this.prisma.deleteRequest.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              email: true,
              name: true,
              role: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.deleteRequest.count(),
    ]);

    return { data: requests, total, page, limit };
  }

  async approveDeleteRequests(ids: string[], confirmCount?: number) {
    const requests = await this.prisma.deleteRequest.findMany({
      where: { id: { in: ids } },
      select: { userId: true },
    });

    if (confirmCount === undefined || confirmCount !== requests.length) {
      throw new BadRequestException(
        `Typed confirmation mismatch: ${requests.length} delete request(s) match the selection. Pass confirmCount equal to that number to approve deletion.`,
      );
    }

    const userIds = requests.map((r) => r.userId);

    const deleteResult = await this.prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });

    await this.auditLogService.log({
      action: 'ADMIN_USER_BULK_DELETE_APPROVE',
      details: JSON.stringify({ count: deleteResult.count, userIds }),
    });

    return { count: deleteResult.count };
  }

  async rejectDeleteRequests(ids: string[], confirmCount?: number) {
    const matchCount = await this.prisma.deleteRequest.count({
      where: { id: { in: ids } },
    });
    if (confirmCount === undefined || confirmCount !== matchCount) {
      throw new BadRequestException(
        `Typed confirmation mismatch: ${matchCount} delete request(s) match the selection. Pass confirmCount equal to that number to reject them.`,
      );
    }

    const result = await this.prisma.deleteRequest.deleteMany({
      where: { id: { in: ids } },
    });

    await this.auditLogService.log({
      action: 'ADMIN_USER_BULK_DELETE_REJECT',
      details: JSON.stringify({ count: result.count, requestIds: ids }),
    });

    return { count: result.count };
  }

  /**
   * Bulk delete Instagram accounts / users by Meta / Instagram scoped User IDs
   * (e.g. from Meta Developer Portal downloaded user identifiers list)
   */
  async bulkDeleteByMetaIds(rawIds: string[], confirmCount?: number) {
    const cleanIds = Array.from(
      new Set(
        rawIds
          .map((id) => (typeof id === 'string' ? id.trim() : String(id).trim()))
          .filter((id) => id.length > 0),
      ),
    );

    if (cleanIds.length === 0) {
      return { found: 0, deleted: 0, notFound: 0, details: [] };
    }

    if (confirmCount === undefined || confirmCount !== cleanIds.length) {
      throw new BadRequestException(
        `Typed confirmation mismatch: ${cleanIds.length} unique Meta User ID(s) were entered. Pass confirmCount equal to that number to purge.`,
      );
    }

    // Look for matching InstagramAccounts by instagramId or instagramPageId
    const matchingAccounts = await this.prisma.instagramAccount.findMany({
      where: {
        OR: [{ instagramId: { in: cleanIds } }, { instagramPageId: { in: cleanIds } }],
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    });

    const foundIds = new Set(matchingAccounts.map((a) => a.instagramId));
    matchingAccounts.forEach((a) => {
      if (a.instagramPageId) foundIds.add(a.instagramPageId);
    });

    const accountIdsToDelete = matchingAccounts.map((a) => a.id);
    let deletedCount = 0;

    if (accountIdsToDelete.length > 0) {
      const del = await this.prisma.instagramAccount.deleteMany({
        where: { id: { in: accountIdsToDelete } },
      });
      deletedCount = del.count;
    }

    // Also check if any IDs match User.id directly
    const matchingUsers = await this.prisma.user.findMany({
      where: { id: { in: cleanIds } },
      select: { id: true, email: true },
    });

    if (matchingUsers.length > 0) {
      const userDel = await this.prisma.user.deleteMany({
        where: { id: { in: matchingUsers.map((u) => u.id) } },
      });
      deletedCount += userDel.count;
    }

    const notFoundIds = cleanIds.filter(
      (id) => !foundIds.has(id) && !matchingUsers.some((u) => u.id === id),
    );

    await this.auditLogService.log({
      action: 'ADMIN_META_DATA_DELETION_BULK_PURGE',
      details: JSON.stringify({
        submittedCount: cleanIds.length,
        deletedAccounts: deletedCount,
        notFoundCount: notFoundIds.length,
      }),
    });

    return {
      found: matchingAccounts.length + matchingUsers.length,
      deleted: deletedCount,
      notFound: notFoundIds.length,
      notFoundIds,
      deletedAccounts: matchingAccounts.map((a) => ({
        instagramId: a.instagramId,
        username: a.username,
        userEmail: a.user?.email,
      })),
      deletedUsers: matchingUsers.map((u) => u.email),
    };
  }

  // ─── Feature Flags ───────────────────────────────────────────────
  getFeatureFlags() {
    return this.featureFlagService.getAll();
  }

  async toggleFeatureFlag(key: string, isEnabled: boolean) {
    const before = await this.prisma.featureFlag.findUnique({ where: { key } });
    const updated = await this.featureFlagService.toggle(key, isEnabled);
    await this.auditLogService.log({
      action: 'ADMIN_FLAG_TOGGLE',
      details: JSON.stringify({
        key,
        before: before ? { isEnabled: before.isEnabled } : null,
        after: { isEnabled },
      }),
    });
    return updated;
  }

  async updateFlagPlans(key: string, plans: Plan[]) {
    const before = await this.prisma.featureFlag.findUnique({ where: { key } });
    const updated = await this.featureFlagService.updatePlans(key, plans);
    await this.auditLogService.log({
      action: 'ADMIN_FLAG_PLANS_UPDATE',
      details: JSON.stringify({
        key,
        before: before ? { enabledForPlans: before.enabledForPlans } : null,
        after: { enabledForPlans: plans.join(',') },
      }),
    });
    return updated;
  }

  // ─── System Health ───────────────────────────────────────────────
  getSystemHealth() {
    return this.monitoringService.getHealth();
  }

  getSystemMetrics() {
    return this.monitoringService.getSystemMetrics();
  }

  async getAppReviewStatus() {
    const snapshot = await this.prisma.appReviewSnapshot.findFirst({
      where: { restoredAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return {
      active: !!snapshot,
      since: snapshot?.createdAt ?? null,
      snapshotId: snapshot?.id ?? null,
    };
  }

  async enableAppReviewMode(confirm: string) {
    if (confirm !== 'ENABLE APP REVIEW') {
      throw new BadRequestException(
        'Typed confirmation required: pass confirm = "ENABLE APP REVIEW" to proceed.',
      );
    }

    // Serializable transaction: exactly one enable can win; a concurrent or
    // failed attempt rolls back instead of snapshotting already-mutated state.
    const result = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.appReviewSnapshot.findFirst({
          where: { restoredAt: null },
        });
        if (existing) {
          throw new BadRequestException(
            'App Review Mode is already active. Restore the existing snapshot before enabling again.',
          );
        }

        const [plans, flags] = await Promise.all([
          tx.billingPlan.findMany(),
          tx.featureFlag.findMany(),
        ]);

        const snapshot = await tx.appReviewSnapshot.create({
          data: {
            plansJson: JSON.stringify(plans),
            flagsJson: JSON.stringify(flags),
          },
        });

        await tx.billingPlan.updateMany({
          data: {
            campaignLimit: -1,
            keywordLimit: -1,
            dmLimitMonthly: -1,
          },
        });

        await tx.featureFlag.updateMany({
          data: {
            isEnabled: true,
            enabledForPlans: 'FREE,PRO,ENTERPRISE',
          },
        });

        return { snapshot, plans, flags };
      },
      { isolationLevel: 'Serializable' },
    );

    await this.auditLogService.log({
      action: 'ADMIN_ENABLE_APP_REVIEW_MODE',
      details: JSON.stringify({
        snapshotId: result.snapshot.id,
        before: {
          plans: result.plans.map((p) => ({
            key: p.key,
            campaignLimit: p.campaignLimit,
            keywordLimit: p.keywordLimit,
            dmLimitMonthly: p.dmLimitMonthly,
          })),
          flags: result.flags.map((f) => ({
            key: f.key,
            isEnabled: f.isEnabled,
            enabledForPlans: f.enabledForPlans,
          })),
        },
      }),
    });

    return {
      success: true,
      message:
        'App Review Mode Active: All plans set to unlimited quotas and all feature flags enabled for all plans! A snapshot was saved; use "Disable App Review Mode" to restore the previous state.',
    };
  }

  async disableAppReviewMode(confirm: string) {
    if (confirm !== 'RESTORE') {
      throw new BadRequestException(
        'Typed confirmation required: pass confirm = "RESTORE" to restore the saved snapshot.',
      );
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const snapshot = await tx.appReviewSnapshot.findFirst({
          where: { restoredAt: null },
          orderBy: { createdAt: 'desc' },
        });
        if (!snapshot) {
          throw new BadRequestException('App Review Mode is not active; nothing to restore.');
        }

        const plans = JSON.parse(snapshot.plansJson) as Array<{
          key: Plan;
          campaignLimit: number;
          keywordLimit: number;
          dmLimitMonthly: number;
        }>;
        const flags = JSON.parse(snapshot.flagsJson) as Array<{
          key: string;
          isEnabled: boolean;
          enabledForPlans: string;
        }>;

        // Conflict detection: if plans or flags were edited after the snapshot
        // (i.e. they no longer match the unlimited state the enable applied),
        // refuse instead of silently overwriting legitimate changes.
        const [currentPlans, currentFlags] = await Promise.all([
          tx.billingPlan.findMany(),
          tx.featureFlag.findMany(),
        ]);
        const driftedPlans = currentPlans
          .filter((p) => p.campaignLimit !== -1 || p.keywordLimit !== -1 || p.dmLimitMonthly !== -1)
          .map((p) => p.key);
        const driftedFlags = currentFlags
          .filter((f) => !f.isEnabled || f.enabledForPlans !== 'FREE,PRO,ENTERPRISE')
          .map((f) => f.key);
        if (driftedPlans.length > 0 || driftedFlags.length > 0) {
          throw new BadRequestException(
            `Restore refused: configuration changed after the snapshot (plans: ${driftedPlans.join(', ') || 'none'}; flags: ${driftedFlags.join(', ') || 'none'}). Review those changes manually first.`,
          );
        }

        for (const plan of plans) {
          await tx.billingPlan.updateMany({
            where: { key: plan.key },
            data: {
              campaignLimit: plan.campaignLimit,
              keywordLimit: plan.keywordLimit,
              dmLimitMonthly: plan.dmLimitMonthly,
            },
          });
        }

        for (const flag of flags) {
          await tx.featureFlag.updateMany({
            where: { key: flag.key },
            data: {
              isEnabled: flag.isEnabled,
              enabledForPlans: flag.enabledForPlans,
            },
          });
        }

        await tx.appReviewSnapshot.update({
          where: { id: snapshot.id },
          data: { restoredAt: new Date() },
        });

        return { snapshot, plans, flags };
      },
      { isolationLevel: 'Serializable' },
    );

    await this.auditLogService.log({
      action: 'ADMIN_DISABLE_APP_REVIEW_MODE',
      details: JSON.stringify({
        snapshotId: result.snapshot.id,
        restoredPlans: result.plans.map((p) => p.key),
        restoredFlags: result.flags.map((f) => f.key),
      }),
    });

    return {
      success: true,
      message: `App Review Mode disabled: plan quotas and feature flags restored from snapshot ${result.snapshot.id}.`,
    };
  }

  // ─── Billing Plans ───────────────────────────────────────────────
  getBillingPlans() {
    return this.prisma.billingPlan.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async updateBillingPlan(
    key: Plan,
    confirmKey: string | undefined,
    data: {
      name?: string;
      description?: string;
      priceMonthly?: number;
      priceYearly?: number;
      campaignLimit?: number;
      keywordLimit?: number;
      dmLimitMonthly?: number;
      accountLimit?: number;
    },
  ) {
    if (confirmKey === undefined || confirmKey.trim() !== key) {
      throw new BadRequestException(
        `Typed confirmation mismatch: pass confirmKey equal to "${key}" to save plan changes.`,
      );
    }
    const before = await this.prisma.billingPlan.findUnique({ where: { key } });
    const updated = await this.prisma.billingPlan.update({
      where: { key },
      data,
    });

    await this.auditLogService.log({
      action: 'ADMIN_PLAN_UPDATE',
      details: JSON.stringify({ key, before, after: data }),
    });

    return updated;
  }

  async getSaaSStats() {
    const [
      creatorsCount,
      campaignsCount,
      usageRecords,
      subscriptions,
      billingPlans,
      recentInvoices,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: UserRole.CREATOR } }),
      this.prisma.campaign.count({ where: { deletedAt: null } }),
      this.prisma.usageRecord.findMany({
        where: { metric: 'max_dms' },
      }),
      this.prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
      }),
      this.prisma.billingPlan.findMany(),
      this.prisma.invoice.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);

    const totalDMsSent = usageRecords.reduce((acc, curr) => acc + curr.value, 0);

    const monthlyPriceMap = Object.fromEntries(billingPlans.map((p) => [p.key, p.priceMonthly]));
    const yearlyPriceMap = Object.fromEntries(billingPlans.map((p) => [p.key, p.priceYearly]));

    const tiersBreakdown = {
      FREE: 0,
      PRO: 0,
      ENTERPRISE: 0,
    };

    let calculatedMRR = 0;

    for (const sub of subscriptions) {
      const plan = sub.plan;
      const isYearly = sub.cycle === 'YEARLY';
      if (plan === Plan.PRO) {
        tiersBreakdown.PRO++;
        calculatedMRR += isYearly
          ? (yearlyPriceMap[Plan.PRO] ?? 9990) / 12
          : (monthlyPriceMap[Plan.PRO] ?? 999);
      } else if (plan === Plan.ENTERPRISE) {
        tiersBreakdown.ENTERPRISE++;
        calculatedMRR += isYearly
          ? (yearlyPriceMap[Plan.ENTERPRISE] ?? 49990) / 12
          : (monthlyPriceMap[Plan.ENTERPRISE] ?? 4999);
      } else {
        tiersBreakdown.FREE++;
      }
    }

    const activeSubscribers = subscriptions.length;

    const recentSignups = await this.prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        subscription: { select: { plan: true } },
      },
    });

    return {
      creatorsCount,
      campaignsCount,
      totalDMsSent,
      activeSubscribers,
      mrr: Math.round(calculatedMRR),
      arr: Math.round(calculatedMRR * 12),
      tiers: tiersBreakdown,
      recentSignups,
      recentInvoices,
    };
  }

  async getPromoSettings() {
    const settings = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: ['promo_banner_text', 'promo_banner_enabled', 'promo_discount_percent'],
        },
      },
    });

    const settingsMap = settings.reduce(
      (acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
      },
      {} as Record<string, string>,
    );

    return {
      text: settingsMap['promo_banner_text'] || '',
      enabled: settingsMap['promo_banner_enabled'] === 'true',
      discountPercent: parseInt(settingsMap['promo_discount_percent'] || '0', 10),
    };
  }

  async updatePromoSettings(data: { text: string; enabled: boolean; discountPercent: number }) {
    await this.prisma.systemSetting.upsert({
      where: { key: 'promo_banner_text' },
      update: { value: data.text },
      create: { key: 'promo_banner_text', value: data.text },
    });

    await this.prisma.systemSetting.upsert({
      where: { key: 'promo_banner_enabled' },
      update: { value: String(data.enabled) },
      create: { key: 'promo_banner_enabled', value: String(data.enabled) },
    });

    await this.prisma.systemSetting.upsert({
      where: { key: 'promo_discount_percent' },
      update: { value: String(data.discountPercent) },
      create: { key: 'promo_discount_percent', value: String(data.discountPercent) },
    });

    return { success: true };
  }

  async getSupportTickets() {
    return this.prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async resolveSupportTicket(id: string) {
    return this.prisma.supportTicket.update({
      where: { id },
      data: { status: 'RESOLVED' },
    });
  }
}
