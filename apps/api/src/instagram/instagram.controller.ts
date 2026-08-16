import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '../config/config.service';
import { InstagramService } from './instagram.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { MediaFetchProducer } from './media-fetch.producer';
import { InstagramCacheService } from './instagram-cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailVerificationGuard } from '../auth/guards/email-verification.guard';

import { ReplyDeskService } from './reply-desk.service';

@Controller('instagram')
export class InstagramController {
  constructor(
    private readonly instagramService: InstagramService,
    private readonly mediaFetchProducer: MediaFetchProducer,
    private readonly cacheService: InstagramCacheService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly replyDeskService: ReplyDeskService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAccounts(@GetUser() user: { id: string }) {
    const accounts = await this.prisma.instagramAccount.findMany({
      where: { userId: user.id, deletedAt: null },
      select: {
        id: true,
        instagramId: true,
        username: true,
        displayName: true,
        profilePicture: true,
        followersCount: true,
        followingCount: true,
        mediaCount: true,
        isConnected: true,
        createdAt: true,
      },
    });

    // Asynchronously trigger background stats sync for each account
    accounts.forEach((acc) => {
      this.instagramService.syncAccountStats(acc.id).catch(() => null);
    });

    return accounts;
  }

  @Get('connect')
  @UseGuards(JwtAuthGuard, EmailVerificationGuard)
  connect(@GetUser() user: { id: string }, @Query('type') type?: 'instagram' | 'facebook') {
    const authUrl = this.instagramService.getAuthUrl(user.id, type || 'instagram');
    return { url: authUrl };
  }

  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
    if (!code || !state) {
      return res.redirect(`${frontendUrl}/dashboard?error=oauth_missing_parameters`);
    }

    try {
      await this.instagramService.exchangeCodeForTokens(code, state);
      return res.redirect(`${frontendUrl}/dashboard?success=instagram_connected`);
    } catch (error) {
      const errMsg =
        error instanceof Error ? encodeURIComponent(error.message) : 'oauth_exchange_failed';
      return res.redirect(`${frontendUrl}/dashboard?error=${errMsg}`);
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disconnect(@Param('id') id: string, @GetUser() user: { id: string }) {
    return this.instagramService.disconnectAccount(id, user.id);
  }

  /**
   * GET /instagram/:accountId/posts
   * Returns cached posts for the account (fetches on first call).
   */
  @Get(':accountId/posts')
  @UseGuards(JwtAuthGuard)
  async getPosts(@Param('accountId') accountId: string, @GetUser() user: { id: string }) {
    // Verify ownership
    const account = await this.prisma.instagramAccount.findFirst({
      where: { id: accountId, userId: user.id, deletedAt: null },
    });
    if (!account) {
      return { posts: [], status: 'account_not_found' };
    }

    const cached = this.cacheService.get(account.instagramId);
    if (cached) {
      return { posts: cached, status: 'cached' };
    }

    // Enqueue fetch job and return empty posts (UI polls until populated)
    await this.mediaFetchProducer.enqueueFetch(accountId);
    return { posts: [], status: 'fetching' };
  }

  /**
   * POST /instagram/:accountId/posts/refresh
   * Force a new media fetch from Instagram.
   */
  @Post(':accountId/posts/refresh')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async refreshPosts(@Param('accountId') accountId: string, @GetUser() user: { id: string }) {
    const account = await this.prisma.instagramAccount.findFirst({
      where: { id: accountId, userId: user.id, deletedAt: null },
    });
    if (account) {
      this.cacheService.clear(account.instagramId);
    }
    return this.mediaFetchProducer.enqueueFetch(accountId);
  }

  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  async getConversations(@GetUser() user: { id: string }) {
    return this.instagramService.getConversations(user.id);
  }

  @Get('conversations/:recipientId/messages')
  @UseGuards(JwtAuthGuard)
  async getMessages(@Param('recipientId') recipientId: string, @GetUser() user: { id: string }) {
    return this.instagramService.getMessages(user.id, recipientId);
  }

  @Post('conversations/:recipientId/messages')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async sendManualMessage(
    @Param('recipientId') recipientId: string,
    @Body() body: { instagramAccountId: string; text: string },
    @GetUser() user: { id: string },
  ) {
    return this.instagramService.sendManualMessage(
      user.id,
      recipientId,
      body.instagramAccountId,
      body.text,
    );
  }

  // ─── Reply Desk AI Query Classifier Endpoints ───────────────────

  @Get('reply-desk')
  @UseGuards(JwtAuthGuard)
  async getReplyDeskQueries(@GetUser() user: { id: string }) {
    return this.replyDeskService.getBuyerQueries(user.id);
  }

  @Post('reply-desk/:id/reply')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async replyToBuyerQuery(
    @Param('id') commentDbId: string,
    @Body('replyText') replyText: string,
    @Body('replyMode') replyMode: 'PUBLIC_COMMENT' | 'PRIVATE_DM',
    @GetUser() user: { id: string },
  ) {
    return this.replyDeskService.replyToBuyer(user.id, commentDbId, replyText, replyMode);
  }
}
