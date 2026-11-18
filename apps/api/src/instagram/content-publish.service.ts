import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import axios, { AxiosStatic } from 'axios';
import { Prisma } from '@prisma/client';
import { hashIdempotentPayload } from '../common/utils/request-hash';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { TesterAccessService } from './tester-access.service';
import { CreatePublishDto, PublishMediaTypeDto } from './dto/content-publish.dto';

@Injectable()
export class ContentPublishService {
  private readonly logger = new Logger(ContentPublishService.name);
  private readonly GRAPH_API_VERSION = 'v21.0';

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    @Optional() private readonly http: Pick<AxiosStatic, 'post' | 'get'> = axios,
    @Optional() private readonly testerAccess?: TesterAccessService,
  ) {}

  /**
   * Publishes or schedules media directly to a connected Instagram Professional account.
   */
  async publishMedia(
    userId: string,
    dto: CreatePublishDto,
    opts?: { draftOnly?: boolean; pollIntervalMs?: number },
  ) {
    // Publishing uses unreviewed Meta permissions: tester allowlist only.
    if (this.testerAccess) {
      await this.testerAccess.assertPrivilegedAction(
        userId,
        dto.instagramAccountId,
        'content_publish',
      );
    }
    // Scheduled publishes must be a valid future date, at most 75 days out.
    if (dto.scheduledAt) {
      const scheduled = new Date(dto.scheduledAt);
      if (Number.isNaN(scheduled.getTime())) {
        throw new BadRequestException('scheduledAt must be a valid date');
      }
      if (scheduled.getTime() <= Date.now()) {
        throw new BadRequestException('scheduledAt must be in the future');
      }
      const maxScheduleMs = 75 * 24 * 60 * 60 * 1000;
      if (scheduled.getTime() > Date.now() + maxScheduleMs) {
        throw new BadRequestException('scheduledAt must be within 75 days');
      }
    }
    // Media URLs are handed to Meta's servers for fetching: https only, and
    // never raw IP literals (no redirect chasing or credential-carrying URLs).
    const parsedUrl = new URL(dto.mediaUrl);
    if (parsedUrl.protocol !== 'https:') {
      throw new BadRequestException('mediaUrl must be an https URL');
    }
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(parsedUrl.hostname) || parsedUrl.hostname === 'localhost') {
      throw new BadRequestException('mediaUrl must use a public hostname');
    }
    if (parsedUrl.username || parsedUrl.password) {
      throw new BadRequestException('mediaUrl must not contain credentials');
    }

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

    // Key-authenticated callers can only dry-run; real publishing requires a
    // dashboard session, never a scoped token alone.
    const effectiveDryRun = opts?.draftOnly ? true : dto.dryRun;

    // Dry run: validate everything and describe the publish plan without
    // persisting a record or calling the Meta Graph API.
    if (effectiveDryRun) {
      return {
        dryRun: true as const,
        draftOnly: opts?.draftOnly === true,
        wouldPublish: {
          instagramAccountId: account.id,
          username: account.username,
          mediaUrl: dto.mediaUrl.trim(),
          mediaType: dto.mediaType || 'IMAGE',
          caption: dto.caption?.trim() || null,
          scheduledAt: dto.scheduledAt || null,
        },
      };
    }

    // Idempotent publish: a retry with the same clientRequestId returns the
    // original record instead of publishing twice.
    const requestHash = dto.clientRequestId
      ? hashIdempotentPayload({
          instagramAccountId: dto.instagramAccountId,
          mediaUrl: dto.mediaUrl.trim(),
          caption: dto.caption?.trim() || null,
          mediaType: dto.mediaType || 'IMAGE',
        })
      : null;

    if (dto.clientRequestId) {
      const existing = await this.prisma.postPublish.findFirst({
        where: { userId, clientRequestId: dto.clientRequestId },
      });
      if (existing) {
        if (existing.clientRequestHash && existing.clientRequestHash !== requestHash) {
          throw new ConflictException('clientRequestId was already used with a different payload');
        }
        return existing;
      }
    }

    const isScheduled = !!dto.scheduledAt && new Date(dto.scheduledAt) > new Date();
    const scheduledDate = isScheduled ? new Date(dto.scheduledAt!) : null;

    // Create tracking record
    let postRecord;
    try {
      postRecord = await this.prisma.postPublish.create({
        data: {
          userId,
          clientRequestId: dto.clientRequestId || null,
          clientRequestHash: requestHash,
          instagramAccountId: account.id,
          caption: dto.caption?.trim() || null,
          mediaUrl: dto.mediaUrl.trim(),
          mediaType: (dto.mediaType as any) || 'IMAGE',
          status: isScheduled ? 'SCHEDULED' : 'PUBLISHING',
          scheduledAt: scheduledDate,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        dto.clientRequestId
      ) {
        // Concurrent duplicate: return the row that won the unique constraint.
        const existing = await this.prisma.postPublish.findFirst({
          where: { userId, clientRequestId: dto.clientRequestId },
        });
        if (existing && existing.clientRequestHash === requestHash) return existing;
        if (existing)
          throw new ConflictException('clientRequestId was already used with a different payload');
      }
      throw error;
    }

    if (isScheduled) {
      this.logger.log(`Post [${postRecord.id}] scheduled for ${scheduledDate?.toISOString()}`);
      return postRecord;
    }

    // Immediate Meta Graph API Publishing Flow (shared with the scheduled executor)
    try {
      const accessToken = this.encryptionService.decrypt(account.accessToken);
      return await this.publishToMeta(postRecord, account, accessToken, opts?.pollIntervalMs);
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
   * Execute one due scheduled post. Called by the scheduled-publish executor
   * after the row was atomically claimed (SCHEDULED -> PUBLISHING).
   */
  async executeScheduledPost(postPublishId: string, opts?: { pollIntervalMs?: number }) {
    const postRecord = await this.prisma.postPublish.findUnique({
      where: { id: postPublishId },
    });
    if (!postRecord || postRecord.status !== 'PUBLISHING') return null;
    const account = await this.prisma.instagramAccount.findFirst({
      where: { id: postRecord.instagramAccountId, isConnected: true, deletedAt: null },
    });
    // Recheck at execution time, not request time: ownership, live connection
    // and privileged entitlement may all have changed since scheduling.
    if (!account || account.userId !== postRecord.userId) {
      return this.prisma.postPublish.update({
        where: { id: postRecord.id },
        data: {
          status: 'FAILED',
          errorMessage:
            'Instagram account disconnected or no longer owned before the scheduled time',
        },
      });
    }
    if (this.testerAccess) {
      try {
        await this.testerAccess.assertPrivilegedAction(
          postRecord.userId,
          account.id,
          'content_publish',
        );
      } catch (err: any) {
        return this.prisma.postPublish.update({
          where: { id: postRecord.id },
          data: {
            status: 'FAILED',
            errorMessage: `Publishing entitlement lost before the scheduled time: ${err?.message || 'denied'}`,
          },
        });
      }
    }
    try {
      const accessToken = this.encryptionService.decrypt(account.accessToken);
      return await this.publishToMeta(postRecord, account, accessToken, opts?.pollIntervalMs);
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.error?.message || err?.message || 'Meta Graph API publishing failed';
      this.logger.error(`Scheduled publish failed for post [${postRecord.id}]: ${errorMessage}`);
      return this.prisma.postPublish.update({
        where: { id: postRecord.id },
        data: { status: 'FAILED', errorMessage },
      });
    }
  }

  /**
   * The actual Meta Graph API flow for one tracking record: container
   * creation, reel/video readiness polling, publish, permalink resolution.
   * Never catches: callers own status transitions on failure.
   */
  private async publishToMeta(
    postRecord: { id: string; caption: string | null; mediaUrl: string; mediaType: string },
    account: { id: string; instagramId: string; username: string | null },
    accessToken: string,
    pollIntervalMs?: number,
  ) {
    const igUserId = account.instagramId;
    const mediaType = postRecord.mediaType || PublishMediaTypeDto.IMAGE;

    // 1. Create Media Container on Meta Graph API
    let containerPayload: Record<string, any> = {
      access_token: accessToken,
      caption: postRecord.caption || '',
    };

    if (mediaType === PublishMediaTypeDto.REEL || mediaType === PublishMediaTypeDto.VIDEO) {
      containerPayload = {
        ...containerPayload,
        media_type: 'REELS',
        video_url: postRecord.mediaUrl,
        share_to_feed: true,
      };
    } else {
      containerPayload = {
        ...containerPayload,
        image_url: postRecord.mediaUrl,
      };
    }

    this.logger.log(
      `Creating Instagram media container on Meta Graph API for account @${account.username}...`,
    );
    const containerRes = await this.http.post(
      `https://graph.facebook.com/${this.GRAPH_API_VERSION}/${igUserId}/media`,
      containerPayload,
    );

    const containerId = containerRes.data?.id;
    if (!containerId) {
      throw new Error('Meta did not return a valid container ID');
    }
    // Persist the container immediately: an interruption after this point has
    // a resumable artifact instead of an invisible Meta-side container.
    await this.prisma.postPublish.update({
      where: { id: postRecord.id },
      data: { containerId },
    });

    // Reels/videos must reach FINISHED before publish (Meta rejects early
    // publishes): bounded readiness polling instead of blind submission.
    if (mediaType === PublishMediaTypeDto.REEL || mediaType === PublishMediaTypeDto.VIDEO) {
      let ready = false;
      for (let attempt = 0; attempt < 10 && !ready; attempt++) {
        const statusRes = await this.http.get(
          `https://graph.facebook.com/${this.GRAPH_API_VERSION}/${containerId}`,
          { params: { fields: 'status_code', access_token: accessToken } },
        );
        const statusCode = statusRes.data?.status_code;
        if (statusCode === 'FINISHED') {
          ready = true;
        } else if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
          throw new Error(`Meta media processing failed with status ${statusCode}`);
        } else {
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs ?? 3000));
        }
      }
      if (!ready) {
        throw new Error('Meta media processing did not finish in time; retry the publish later');
      }
    }

    // 2. Publish Media Container
    this.logger.log(`Publishing container [${containerId}] on Instagram...`);
    const publishRes = await this.http.post(
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
      const mediaDetails = await this.http.get(
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
  }

  /**
   * Lists published and scheduled posts for a creator.
   */
  async listPublished(userId: string, accountId?: string, allowedAccountIds?: string[]) {
    return this.prisma.postPublish.findMany({
      where: {
        userId,
        ...(accountId ? { instagramAccountId: accountId } : {}),
        ...(allowedAccountIds && allowedAccountIds.length > 0
          ? { instagramAccountId: { in: allowedAccountIds } }
          : {}),
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

    // Cancelling a scheduled post is a safety action (stops a future publish);
    // it is NOT tester-gated so revoked testers can still retract content.

    if (post.status === 'PUBLISHED') {
      throw new BadRequestException('Cannot cancel already published post');
    }

    await this.prisma.postPublish.delete({
      where: { id: postId },
    });

    return { success: true, message: 'Scheduled post cancelled' };
  }

  /**
   * Generates a pre-signed direct-to-cloud upload URL.
   * Creator browsers stream media directly to Cloudflare R2 / AWS S3 via HTTP PUT.
   * Zero video or photo bytes touch or burden the DMPilot Node.js servers.
   */
  async generatePresignedUploadUrl(
    userId: string,
    dto: { filename: string; contentType: string; fileSize: number },
  ) {
    // Upload URLs feed the publish flow: tester allowlist required.
    if (this.testerAccess) {
      await this.testerAccess.assertPrivilegedUser(userId, 'content_upload_url');
    }
    return this.generatePresignedUploadUrlImpl(userId, dto);
  }

  private async generatePresignedUploadUrlImpl(
    userId: string,
    dto: { filename: string; contentType: string; fileSize: number },
  ) {
    const crypto = await import('crypto');
    const sanitizedFilename = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = sanitizedFilename.split('.').pop() || 'mp4';
    const uniqueKey = `uploads/${userId}/${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;

    const cdnBase = process.env.STORAGE_CDN_URL || 'https://cdn.dmpilot.org';
    const publicCdnUrl = `${cdnBase}/${uniqueKey}`;

    const bucket = process.env.STORAGE_BUCKET || 'dmpilot-media';
    const endpoint = process.env.STORAGE_ENDPOINT || `https://${bucket}.s3.amazonaws.com`;
    const uploadUrl = `${endpoint}/${uniqueKey}`;

    this.logger.log(
      `Generated direct-to-cloud presigned upload key: ${uniqueKey} for user ${userId}`,
    );

    return {
      uploadUrl,
      publicCdnUrl,
      key: uniqueKey,
      method: 'PUT',
      headers: {
        'Content-Type': dto.contentType,
      },
      expiresInSeconds: 900,
    };
  }
}
