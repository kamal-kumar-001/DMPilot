import { ForbiddenException, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../auth/audit-log.service';

/**
 * Phase 4 tester gate for Meta Unified Login privileged flows.
 *
 * Meta apps in development mode can hold unreviewed permissions, but they only
 * work for people with a role on the app. This service is the LOCAL allowlist
 * that mirrors that intent: publishing, ads and the privileged (unified)
 * connect flow stay denied until an owner/account pair is explicitly listed
 * here AND PRIVILEGED_FLOWS_ENABLED=true. The allowlist alone never grants
 * Meta-side access; it only stops unreviewed scopes/actions from being used
 * by ordinary users.
 *
 * Fail closed everywhere: missing env flag, missing entry, or an entry for a
 * different account all deny. Removal takes effect on the next action because
 * every check reads the database (no caching).
 */
@Injectable()
export class TesterAccessService {
  private readonly logger = new Logger(TesterAccessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Optional() private readonly auditLog?: AuditLogService,
  ) {}

  /** Rollback switch: disables all privileged flows without touching the allowlist. */
  isEnabled(): boolean {
    return this.configService.get<string>('PRIVILEGED_FLOWS_ENABLED') === 'true';
  }

  private async deny(userId: string, what: string, reason: string): Promise<never> {
    this.logger.warn(`Privileged access denied for user [${userId}]: ${reason}`);
    await Promise.resolve(
      this.auditLog?.log({
        userId,
        action: 'tester_access.denied',
        details: `${what} reason=${reason}`,
      }),
    ).catch((err: Error) => this.logger.error(`Tester denial audit failed: ${err.message}`));
    throw new ForbiddenException(
      'This feature requires Meta tester access that is not enabled for your account.',
    );
  }

  /** Owner-level gate for the privileged (unified) connect flow. */
  async assertPrivilegedConnect(userId: string): Promise<void> {
    if (!this.isEnabled()) {
      return this.deny(userId, 'privileged_connect', 'privileged_flows_disabled');
    }
    const entry = await this.prisma.testerAllowlistEntry.findFirst({
      where: { userId, instagramAccountId: null },
      select: { id: true },
    });
    if (!entry) {
      return this.deny(userId, 'privileged_connect', 'not_on_tester_allowlist');
    }
  }

  /** User-level gate for privileged actions that are not tied to one account yet (e.g. upload URLs). */
  async assertPrivilegedUser(userId: string, what: string): Promise<void> {
    if (!this.isEnabled()) {
      return this.deny(userId, what, 'privileged_flows_disabled');
    }
    const entry = await this.prisma.testerAllowlistEntry.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!entry) {
      return this.deny(userId, what, 'not_on_tester_allowlist');
    }
  }

  /** Account-scoped gate for publish/ads actions. */
  async assertPrivilegedAction(
    userId: string,
    instagramAccountId: string,
    what: string,
  ): Promise<void> {
    if (!this.isEnabled()) {
      return this.deny(userId, what, 'privileged_flows_disabled');
    }
    const entry = await this.prisma.testerAllowlistEntry.findFirst({
      where: {
        userId,
        OR: [{ instagramAccountId: null }, { instagramAccountId }],
      },
      select: { id: true },
    });
    if (!entry) {
      return this.deny(userId, what, 'not_on_tester_allowlist');
    }
  }

  /** UI status: pending-no-flash surfaces read this before rendering locks. */
  async getStatus(userId: string) {
    const entries = this.isEnabled()
      ? await this.prisma.testerAllowlistEntry.findMany({
          where: { userId },
          select: { instagramAccountId: true },
        })
      : [];
    return {
      privilegedFlowsEnabled: this.isEnabled(),
      ownerLevel: entries.some((e) => e.instagramAccountId === null),
      accountIds: entries
        .map((e) => e.instagramAccountId)
        .filter((id): id is string => typeof id === 'string'),
    };
  }

  async listEntries() {
    return this.prisma.testerAllowlistEntry.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } },
        instagramAccount: { select: { id: true, username: true } },
      },
    });
  }

  async addEntry(
    adminUserId: string,
    userId: string,
    instagramAccountId: string | null,
    note?: string,
  ) {
    // The account must belong to the user being granted access.
    if (instagramAccountId) {
      const account = await this.prisma.instagramAccount.findFirst({
        where: { id: instagramAccountId, userId, deletedAt: null },
        select: { id: true },
      });
      if (!account) {
        throw new ForbiddenException('instagramAccountId does not belong to this user');
      }
    }
    const existing = await this.prisma.testerAllowlistEntry.findFirst({
      where: { userId, instagramAccountId: instagramAccountId ?? null },
      select: { id: true },
    });
    if (existing) return existing;
    const entry = await this.prisma.testerAllowlistEntry.create({
      data: {
        userId,
        instagramAccountId: instagramAccountId ?? null,
        note,
        createdByUserId: adminUserId,
      },
    });
    await Promise.resolve(
      this.auditLog?.log({
        userId: adminUserId,
        action: 'tester_allowlist.add',
        details: `entry=${entry.id} user=${userId} account=${instagramAccountId ?? 'owner-level'}`,
      }),
    ).catch((err: Error) => this.logger.error(`Tester add audit failed: ${err.message}`));
    return entry;
  }

  async removeEntry(adminUserId: string, entryId: string) {
    const entry = await this.prisma.testerAllowlistEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new ForbiddenException('Allowlist entry not found');
    await this.prisma.testerAllowlistEntry.delete({ where: { id: entryId } });
    await Promise.resolve(
      this.auditLog?.log({
        userId: adminUserId,
        action: 'tester_allowlist.remove',
        details: `entry=${entryId} user=${entry.userId} account=${entry.instagramAccountId ?? 'owner-level'}`,
      }),
    ).catch((err: Error) => this.logger.error(`Tester remove audit failed: ${err.message}`));
    return { removed: true };
  }
}
