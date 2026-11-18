import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { CreatePublishDto, PublishMediaTypeDto } from './dto/content-publish.dto';

@Injectable()
export class ContentPublishService {
  private readonly logger = new Logger(ContentPublishService.name);
  private readonly GRAPH_API_VERSION = 'v21.0';

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Publishes or schedules media directly to a connected Instagram Professional account.
   */
  async publishMedia(userId: string, dto: CreatePublishDto) {
    const account = await this.prisma.instagramAccount.findFirst({
      where: {
        id: dto.instagramAccountId,
        userId,
        isConnected: true,
        deletedAt: null,
      },
    });

    if (!account) {
      throw new NotFoundException('Instagram account not found or not connected');
    }

    const isScheduled = !!dto.scheduledAt && new Date(dto.scheduledAt) > new Date();
    const scheduledDate = isScheduled ? new Date(dto.scheduledAt!) : null;

    // Create tracking record
    const postRecord = await this.prisma.postPublish.create({
      data: {
        userId,
        instagramAccountId: account.id,
        caption: dto.caption?.trim() || null,
        mediaUrl: dto.mediaUrl.trim(),
        mediaType: (dto.mediaType as any) || 'IMAGE',
        status: isScheduled ? 'SCHEDULED' : 'PUBLISHING',
        scheduledAt: scheduledDate,
      },
    });

    if (isScheduled) {
      this.logger.log(`Post [${postRecord.id}] scheduled for ${scheduledDate?.toISOString()}`);
      return postRecord;
    }

    // Immediate Meta Graph API Publishing Flow
    try {
      const accessToken = this.encryptionService.decrypt(account.accessToken);
      const igUserId = account.instagramId;
      const mediaType = dto.mediaType || PublishMediaTypeDto.IMAGE;

      // 1. Create Media Container on Meta Graph API
      let containerPayload: Record<string, any> = {
        access_token: accessToken,
        caption: dto.caption || '',
      };

      if (mediaType === PublishMediaTypeDto.REEL || mediaType === PublishMediaTypeDto.VIDEO) {
        containerPayload = {
          ...containerPayload,
          media_type: 'REELS',
          video_url: dto.mediaUrl,
          share_to_feed: true,
        };
      } else {
        containerPayload = {
          ...containerPayload,
          image_url: dto.mediaUrl,
        };
      }

      this.logger.log(
        `Creating Instagram media container on Meta Graph API for account @${account.username}...`,
      );
      const containerRes = await axios.post(
        `https://graph.facebook.com/${this.GRAPH_API_VERSION}/${igUserId}/media`,
        containerPayload,
      );

      const containerId = containerRes.data?.id;
      if (!containerId) {
        throw new Error('Meta did not return a valid container ID');
      }

      // 2. Publish Media Container
      this.logger.log(`Publishing container [${containerId}] on Instagram...`);
      const publishRes = await axios.post(
        `https://graph.facebook.com/${this.GRAPH_API_VERSION}/${igUserId}/media_publish`,
        {
          creation_id: containerId,
          access_token: accessToken,
        },
      );

      const publishedMediaId = publishRes.data?.id;

      // 3. Optional: Query permalink
      let permalink: string | null = null;
      try {
        const mediaDetails = await axios.get(
          `https://graph.facebook.com/${this.GRAPH_API_VERSION}/${publishedMediaId}?fields=permalink&access_token=${accessToken}`,
        );
        permalink = mediaDetails.data?.permalink || null;
      } catch (permalinkErr: any) {
        this.logger.warn(
          `Could not resolve permalink for [${publishedMediaId}]: ${permalinkErr.message}`,
        );
      }

      const updated = await this.prisma.postPublish.update({
        where: { id: postRecord.id },
        data: {
          status: 'PUBLISHED',
          containerId,
          publishedMediaId,
          permalink,
          publishedAt: new Date(),
        },
      });

      this.logger.log(
        `Post [${postRecord.id}] successfully published to Instagram! Media ID: ${publishedMediaId}`,
      );
      return updated;
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.error?.message || err?.message || 'Meta Graph API publishing failed';
      this.logger.error(`Failed to publish media for @${account.username}: ${errorMessage}`);

      await this.prisma.postPublish.update({
        where: { id: postRecord.id },
        data: {
          status: 'FAILED',
          errorMessage,
        },
      });

      throw new BadRequestException(`Instagram publishing failed: ${errorMessage}`);
    }
  }

  /**
   * Lists published and scheduled posts for a creator.
   */
  async listPublished(userId: string, accountId?: string) {
    return this.prisma.postPublish.findMany({
      where: {
        userId,
        ...(accountId ? { instagramAccountId: accountId } : {}),
      },
      include: {
        instagramAccount: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profilePicture: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Cancels a scheduled post before delivery.
   */
  async cancelPost(userId: string, postId: string) {
    const post = await this.prisma.postPublish.findFirst({
      where: { id: postId, userId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.status === 'PUBLISHED') {
      throw new BadRequestException('Cannot cancel already published post');
    }

    await this.prisma.postPublish.delete({
      where: { id: postId },
    });

    return { success: true, message: 'Scheduled post cancelled' };
  }
}
