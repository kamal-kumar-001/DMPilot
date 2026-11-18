import {
  BadRequestException,
  HttpException,
  HttpStatus,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto, ApiKeyResponseDto, CreateApiKeyResponseDto } from './dto/api-key.dto';
import { AuditLogService } from './audit-log.service';
import {
  DEFAULT_API_KEY_SCOPES,
  isValidScope,
  extractCandidateAccountId,
} from './utils/api-key-scopes';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog?: AuditLogService,
  ) {}

  /**
   * Hashes a raw token using SHA-256 to ensure secrets are never stored in plaintext.
   */
  private hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
  }

  /**
   * Generates a cryptographically strong Personal Access Token (PAT).
   */
  async createApiKey(userId: string, dto: CreateApiKeyDto): Promise<CreateApiKeyResponseDto> {
    // Fail closed on minting: only verified accounts can create keys.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isVerified: true },
    });
    if (!user?.isVerified) {
      throw new ForbiddenException('Verify your email before creating API keys');
    }

    // Least privilege by default; every requested scope must be a known scope.
    const scopes = dto.scopes && dto.scopes.length > 0 ? dto.scopes : DEFAULT_API_KEY_SCOPES;
    for (const scope of scopes) {
      if (!isValidScope(scope)) {
        throw new BadRequestException(`Unknown API key scope: ${scope}`);
      }
    }

    // Account restrictions must reference the user's own connected accounts.
    const instagramAccountIds = dto.instagramAccountIds ?? [];
    if (instagramAccountIds.length > 0) {
      const owned = await this.prisma.instagramAccount.count({
        where: { id: { in: instagramAccountIds }, userId, deletedAt: null },
      });
      if (owned !== instagramAccountIds.length) {
        throw new BadRequestException(
          'instagramAccountIds must be your own connected Instagram accounts',
        );
      }
    }

    const randomHex = crypto.randomBytes(24).toString('hex');
    const rawKey = `dmp_live_${randomHex}`;
    const keyHash = this.hashKey(rawKey);
    const prefix = `${rawKey.substring(0, 16)}...`;

    let expiresAt: Date | null = null;
    if (dto.expiresInDays && dto.expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + dto.expiresInDays);
    }

    const created = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name.trim(),
        keyHash,
        prefix,
        scopes,
        instagramAccountIds,
        expiresAt,
      },
    });

    this.logger.log(
      `Created new API key [id: ${created.id}, prefix: ${prefix}, scopes: ${scopes.join(',')}] for user [${userId}]`,
    );
    await this.auditLog?.log({
      userId,
      action: 'api_key.create',
      details: `key=${created.id} scopes=${scopes.join(',')} accounts=${instagramAccountIds.length}`,
    });

    return {
      id: created.id,
      name: created.name,
      prefix: created.prefix,
      scopes: created.scopes,
      instagramAccountIds: created.instagramAccountIds,
      expiresAt: created.expiresAt,
      createdAt: created.createdAt,
      lastUsedAt: created.lastUsedAt,
      apiKey: rawKey, // Only returned once upon creation!
    };
  }

  /**
   * Lists all active (non-revoked) API keys for a user with safe masked prefixes.
   */
  async listApiKeys(userId: string): Promise<ApiKeyResponseDto[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        instagramAccountIds: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return keys;
  }

  /**
   * Revokes an API key belonging to a specific user.
   */
  async revokeApiKey(
    userId: string,
    keyId: string,
  ): Promise<{ success: boolean; message: string }> {
    const key = await this.prisma.apiKey.findFirst({
      where: {
        id: keyId,
        userId,
        deletedAt: null,
      },
    });

    if (!key) {
      throw new NotFoundException('API key not found or already revoked');
    }

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Revoked API key [id: ${keyId}] for user [${userId}]`);
    await this.auditLog?.log({ userId, action: 'api_key.revoke', details: `key=${keyId}` });
    return { success: true, message: 'API key successfully revoked' };
  }

  /**
   * Validates a raw API key presented via Authorization header or x-api-key header.
   * Updates lastUsedAt asynchronously.
   */
  async validateApiKey(rawKey: string): Promise<{
    user: { id: string; email: string; role: any; isVerified: boolean };
    apiKey: { id: string; scopes: string[]; instagramAccountIds: string[] };
  } | null> {
    if (!rawKey || !rawKey.startsWith('dmp_live_')) {
      return null;
    }

    const keyHash = this.hashKey(rawKey);

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            isVerified: true,
          },
        },
      },
    });

    if (!apiKey || apiKey.deletedAt !== null) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      this.logger.warn(`Rejected expired API key [id: ${apiKey.id}]`);
      return null;
    }

    // Atomic per-key rate limit + lastUsedAt in one statement so concurrent
    // requests cannot both pass the window check.
    const limit = apiKey.rateLimitPerMin ?? 60;
    try {
      const rows = await this.prisma.$queryRaw<Array<{ rateWindowCount: number }>>`
        UPDATE "ApiKey"
        SET "rateWindowCount" = CASE
              WHEN "rateWindowStart" IS NULL OR "rateWindowStart" < NOW() - INTERVAL '1 minute' THEN 1
              ELSE "rateWindowCount" + 1
            END,
            "rateWindowStart" = CASE
              WHEN "rateWindowStart" IS NULL OR "rateWindowStart" < NOW() - INTERVAL '1 minute' THEN NOW()
              ELSE "rateWindowStart"
            END,
            "lastUsedAt" = NOW()
        WHERE "id" = ${apiKey.id}
        RETURNING "rateWindowCount"`;
      if (rows[0] && rows[0].rateWindowCount > limit) {
        this.logger.warn(`Rate limit exceeded for API key [id: ${apiKey.id}]`);
        throw new HttpException('API key rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      // Rate accounting must not take the API down, but failures are logged.
      this.logger.error(`Rate accounting failed for key [${apiKey.id}]: ${(err as Error).message}`);
    }

    return {
      user: apiKey.user,
      apiKey: {
        id: apiKey.id,
        // Legacy keys created before scopes existed (empty column) are read-only.
        scopes: apiKey.scopes && apiKey.scopes.length > 0 ? apiKey.scopes : ['read'],
        instagramAccountIds: apiKey.instagramAccountIds ?? [],
      },
    };
  }

  /** Per-action audit attribution for key-authenticated writes. */
  recordKeyAction(apiKeyId: string, userId: string, method: string, path: string) {
    Promise.resolve(
      this.auditLog?.log({
        userId,
        action: 'api_key.request',
        details: `key=${apiKeyId} ${method} ${path}`,
      }),
    ).catch((err: Error) => this.logger.error(`Key audit failed [${apiKeyId}]: ${err.message}`));
  }

  /**
   * Route-aware account allowlist enforcement for restricted keys.
   * Covers account ids in body, query and route params (accountId), the
   * /instagram/:id/verify-webhook param, and campaign/post resource ids
   * resolved to their owning account. Restricted keys fail closed.
   */
  async assertKeyAccountAccess(
    apiKey: { id: string; instagramAccountIds: string[] },
    req: { method?: string; path?: string; url?: string; body?: any; params?: any; query?: any },
  ): Promise<{ ok: boolean; reason?: string }> {
    const allowed = apiKey.instagramAccountIds;
    if (!allowed || allowed.length === 0) return { ok: true };

    let candidate = extractCandidateAccountId(req);
    const path = (req.path || req.url || '').split('?')[0];

    if (!candidate && /^\/instagram\/[^/]+\/verify-webhook/.test(path) && req.params?.id) {
      candidate = String(req.params.id);
    }

    if (!candidate) {
      const campaignMatch = path.match(/^\/campaigns\/([^/]+)/);
      if (campaignMatch) {
        const campaign = await this.prisma.campaign.findFirst({
          where: { id: campaignMatch[1], deletedAt: null },
          select: { instagramAccountId: true },
        });
        if (!campaign) return { ok: false, reason: 'resource_not_found' };
        candidate = campaign.instagramAccountId;
      }
      const postMatch = path.match(/^\/content\/([^/]+)/);
      if (
        !candidate &&
        postMatch &&
        postMatch[1] !== 'publish' &&
        postMatch[1] !== 'presigned-url'
      ) {
        const post = await this.prisma.postPublish.findFirst({
          where: { id: postMatch[1] },
          select: { instagramAccountId: true },
        });
        if (!post) return { ok: false, reason: 'resource_not_found' };
        candidate = post.instagramAccountId;
      }
    }

    if (candidate && !allowed.includes(candidate)) {
      return { ok: false, reason: 'account_not_in_key_scope' };
    }
    return { ok: true };
  }
}
