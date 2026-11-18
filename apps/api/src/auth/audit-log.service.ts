import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    params: {
      userId?: string;
      action: string;
      details?: string;
      ipAddress?: string;
      userAgent?: string;
    },
    opts?: { force?: boolean },
  ) {
    try {
      // Safety-critical audit entries (e.g. audit-log purge) must persist even
      // when ordinary audit logging is paused via the audit_logging flag.
      if (!opts?.force) {
        const flag = await this.prisma.featureFlag.findUnique({
          where: { key: 'audit_logging' },
        });
        if (flag && !flag.isEnabled) {
          return;
        }
      }

      await this.prisma.auditLog.create({
        data: {
          userId: params.userId || null,
          action: params.action,
          details: params.details || null,
          ipAddress: params.ipAddress || null,
          userAgent: params.userAgent || null,
        },
      });
    } catch (error) {
      console.error('⚠️ Failed to write audit log:', error);
    }
  }
}
