import { Injectable, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto, ApiKeyResponseDto, CreateApiKeyResponseDto } from './dto/api-key.dto';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(private readonly prisma: PrismaService) {}

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
        expiresAt,
      },
    });

    this.logger.log(
      `Created new API key [id: ${created.id}, prefix: ${prefix}] for user [${userId}]`,
    );

    return {
      id: created.id,
      name: created.name,
      prefix: created.prefix,
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
    return { success: true, message: 'API key successfully revoked' };
  }

  /**
   * Validates a raw API key presented via Authorization header or x-api-key header.
   * Updates lastUsedAt asynchronously.
   */
  async validateApiKey(
    rawKey: string,
  ): Promise<{ id: string; email: string; role: any; isVerified: boolean } | null> {
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

    // Update lastUsedAt asynchronously in the background
    this.prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) => {
        this.logger.error(`Failed to update lastUsedAt for key [${apiKey.id}]: ${err.message}`);
      });

    return apiKey.user;
  }
}
