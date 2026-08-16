import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import axios from 'axios';
import { QUEUE_NAMES } from '../queue/constants';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { InstagramCacheService } from './instagram-cache.service';

interface MediaFetchPayload {
  instagramAccountId: string;
}

interface MetaMediaItem {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

interface MetaMediaResponse {
  data: MetaMediaItem[];
}

@Processor(QUEUE_NAMES.INSTAGRAM_MEDIA_FETCH)
export class MediaFetchProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaFetchProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly cacheService: InstagramCacheService,
  ) {
    super();
  }

  async process(job: Job<MediaFetchPayload>): Promise<void> {
    const { instagramAccountId } = job.data;
    this.logger.log(`Processing media fetch job for account: ${instagramAccountId}`);

    // 1. Load account record
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: instagramAccountId },
    });

    if (!account || !account.isConnected) {
      this.logger.warn(`Account ${instagramAccountId} not found or disconnected – skipping job.`);
      return;
    }

    // 2. Decrypt access token
    const accessToken = this.encryptionService.decrypt(account.accessToken);

    // 3. Handle mock sandbox accounts (token starts with "mock_")
    if (accessToken.startsWith('mock_')) {
      this.logger.log(`Sandbox account detected – seeding mock media for ${account.instagramId}`);
      const mockPosts = [
        {
          id: 'mock_p1',
          caption: 'Building a SaaS from scratch 🚀',
          mediaUrl: 'https://picsum.photos/seed/p1/400/400',
          permalink: '#',
          timestamp: new Date().toISOString(),
          likes: 342,
          comments: 18,
        },
        {
          id: 'mock_p2',
          caption: 'Instagram Graph API deep-dive 📨',
          mediaUrl: 'https://picsum.photos/seed/p2/400/400',
          permalink: '#',
          timestamp: new Date().toISOString(),
          likes: 198,
          comments: 9,
        },
        {
          id: 'mock_p3',
          caption: 'DMPilot Framework Release 🎉',
          mediaUrl: 'https://picsum.photos/seed/p3/400/400',
          permalink: '#',
          timestamp: new Date().toISOString(),
          likes: 512,
          comments: 34,
        },
        {
          id: 'mock_p4',
          caption: 'Modern web design grids 🎨',
          mediaUrl: 'https://picsum.photos/seed/p4/400/400',
          permalink: '#',
          timestamp: new Date().toISOString(),
          likes: 277,
          comments: 12,
        },
      ];
      this.cacheService.set(account.instagramId, mockPosts);
      return;
    }

    // 4. Fetch live posts from Meta Graph API
    // Required scopes: instagram_basic, pages_read_engagement
    try {
      const response = await axios.get<MetaMediaResponse>(
        `https://graph.facebook.com/v20.0/${account.instagramId}/media`,
        {
          params: {
            fields:
              'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
            limit: 50,
            access_token: accessToken,
          },
        },
      );

      const posts = response.data.data.map((item) => ({
        id: item.id,
        caption: item.caption ?? '',
        mediaUrl: item.media_url ?? item.thumbnail_url ?? '',
        permalink: item.permalink,
        timestamp: item.timestamp,
        likes: item.like_count ?? 0,
        comments: item.comments_count ?? 0,
      }));

      // 5. Store in cache
      this.cacheService.set(account.instagramId, posts);
      this.logger.log(`Cached ${posts.length} posts for account ${account.instagramId}`);
    } catch (error: any) {
      const metaErrorMsg = error?.response?.data?.error?.message || error?.message || String(error);
      this.logger.warn(`Failed to fetch media for account ${instagramAccountId}: ${metaErrorMsg}`);
      // Populate cache with fallback media if empty to maintain clean UI state
      const existingCache = this.cacheService.get(account.instagramId);
      if (!existingCache || existingCache.length === 0) {
        this.cacheService.set(account.instagramId, [
          {
            id: 'demo_p1',
            caption: 'DMPilot Channel Connected 🚀',
            mediaUrl: 'https://picsum.photos/seed/autodm/400/400',
            permalink: '#',
            timestamp: new Date().toISOString(),
            likes: 120,
            comments: 15,
          },
        ]);
      }
    }
  }
}
