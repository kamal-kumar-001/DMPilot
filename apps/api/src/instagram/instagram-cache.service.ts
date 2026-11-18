import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import Redis from 'ioredis';

export interface CachedPost {
  id: string;
  caption: string;
  mediaUrl: string;
  permalink: string;
  timestamp: string;
  likes: number;
  comments: number;
}

/**
 * High-Performance Distributed Cache:
 * Uses Redis cluster/instance when REDIS_URL is configured, with automatic
 * in-memory fallback for local development or transient connection issues.
 */
@Injectable()
export class InstagramCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InstagramCacheService.name);
  private redisClient: Redis | null = null;
  private readonly memoryCache = new Map<string, { data: any; expiresAt: number }>();

  private readonly POSTS_TTL_SECONDS = 15 * 60; // 15 minutes
  private readonly MEDIA_TTL_SECONDS = 24 * 60 * 60; // 24 hours for permanent media details

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get('REDIS_URL');
    if (redisUrl) {
      try {
        this.redisClient = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          connectTimeout: 5000,
        });

        this.redisClient.connect().catch((err) => {
          this.logger.warn(
            `Redis cache connection deferred: ${err.message}. Using memory fallback.`,
          );
        });
      } catch (err: any) {
        this.logger.warn(`Failed to initialize Redis client: ${err.message}`);
      }
    }
  }

  onModuleDestroy() {
    if (this.redisClient) {
      this.redisClient.disconnect(false);
    }
  }

  // ─── Account Posts List Cache ──────────────────────────────────────────

  async set(instagramId: string, posts: CachedPost[]): Promise<void> {
    const key = `cache:ig:posts:${instagramId}`;
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        await this.redisClient.setex(key, this.POSTS_TTL_SECONDS, JSON.stringify(posts));
        return;
      } catch (err: any) {
        this.logger.warn(`Redis set failed: ${err.message}`);
      }
    }
    // Fallback to in-memory
    this.memoryCache.set(key, {
      data: posts,
      expiresAt: Date.now() + this.POSTS_TTL_SECONDS * 1000,
    });
  }

  async get(instagramId: string): Promise<CachedPost[] | undefined> {
    const key = `cache:ig:posts:${instagramId}`;
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        const val = await this.redisClient.get(key);
        if (val) {
          return JSON.parse(val);
        }
      } catch (err: any) {
        this.logger.warn(`Redis get failed: ${err.message}`);
      }
    }

    const entry = this.memoryCache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  async clear(instagramId: string): Promise<void> {
    const key = `cache:ig:posts:${instagramId}`;
    if (this.redisClient && this.redisClient.status === 'ready') {
      await this.redisClient.del(key).catch(() => null);
    }
    this.memoryCache.delete(key);
  }

  // ─── Individual Media Metadata Cache (Permalinks & Titles) ──────────────

  async setMediaDetails(
    mediaId: string,
    details: { permalink: string; caption?: string; title?: string },
  ): Promise<void> {
    const key = `cache:ig:media:${mediaId}`;
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        await this.redisClient.setex(key, this.MEDIA_TTL_SECONDS, JSON.stringify(details));
        return;
      } catch (err: any) {
        this.logger.warn(`Redis setMediaDetails failed: ${err.message}`);
      }
    }
    this.memoryCache.set(key, {
      data: details,
      expiresAt: Date.now() + this.MEDIA_TTL_SECONDS * 1000,
    });
  }

  async getMediaDetails(
    mediaId: string,
  ): Promise<{ permalink: string; caption?: string; title?: string } | undefined> {
    const key = `cache:ig:media:${mediaId}`;
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        const val = await this.redisClient.get(key);
        if (val) {
          return JSON.parse(val);
        }
      } catch (err: any) {
        this.logger.warn(`Redis getMediaDetails failed: ${err.message}`);
      }
    }

    const entry = this.memoryCache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return undefined;
    }
    return entry.data;
  }
}
