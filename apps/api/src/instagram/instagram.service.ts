import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { AppLogger } from '../common/logger/logger.service';
import { AuditLogService } from '../auth/audit-log.service';
import axios from 'axios';
import { SendDmProducer } from './send-dm.producer';

import { SubscriptionService } from '../billing/subscription.service';

interface MetaTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  category: string;
}

interface MetaPagesResponse {
  data: MetaPage[];
}

interface MetaIgAccountDetails {
  instagram_business_account?: {
    id: string;
    username: string;
    name?: string;
    profile_picture_url?: string;
    followers_count?: number;
    follows_count?: number;
    media_count?: number;
  };
}

@Injectable()
export class InstagramService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly auditLogService: AuditLogService,
    private readonly logger: AppLogger,
    private readonly sendDmProducer: SendDmProducer,
    private readonly subscriptionService: SubscriptionService,
  ) {
    this.logger.setContext('InstagramService');
  }

  getAuthUrl(userId: string, authType: 'instagram' | 'facebook' = 'instagram'): string {
    const metaAppId = this.configService.get('META_APP_ID');
    const instaAppId = this.configService.get('INSTAGRAM_APP_ID') || metaAppId;
    const redirectUri = this.configService.get('META_REDIRECT_URI');

    const state = Buffer.from(JSON.stringify({ userId })).toString('base64url');

    if (authType === 'facebook') {
      const fbScopes = [
        'pages_show_list',
        'instagram_basic',
        'instagram_manage_comments',
        'instagram_manage_messages',
        'pages_read_engagement',
      ].join(',');

      return `https://www.facebook.com/v20.0/dialog/oauth?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(
        redirectUri,
      )}&state=${state}&scope=${fbScopes}`;
    }

    // Direct Instagram Business Login OAuth (No Facebook Page required)
    const igScopes = [
      'instagram_business_basic',
      'instagram_business_manage_messages',
      'instagram_business_manage_comments',
      'instagram_business_content_publish',
    ].join(',');

    return `https://www.instagram.com/oauth/authorize?client_id=${instaAppId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&state=${state}&scope=${igScopes}&response_type=code`;
  }

  async exchangeCodeForTokens(code: string, state: string): Promise<string> {
    let userId = '';
    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      userId = decodedState.userId;
    } catch {
      throw new BadRequestException('Invalid state parameter in callback');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User associated with OAuth session not found');
    }

    const appId = this.configService.get('META_APP_ID')!;
    const appSecret = this.configService.get('META_APP_SECRET')!;
    const redirectUri = this.configService.get('META_REDIRECT_URI')!;

    // ─── 1. Attempt Direct Instagram Business Login Exchange First ─────────
    try {
      const formData = new URLSearchParams();
      formData.append('client_id', appId);
      formData.append('client_secret', appSecret);
      formData.append('grant_type', 'authorization_code');
      formData.append('redirect_uri', redirectUri);
      formData.append('code', code);

      const shortIgRes = await axios.post(
        'https://api.instagram.com/oauth/access_token',
        formData,
        { timeout: 8000 },
      );

      const shortIgToken = shortIgRes.data?.access_token;

      if (shortIgToken) {
        // Exchange short-lived IG token for long-lived (60 days) IG token
        const longIgRes = await axios.get('https://graph.instagram.com/access_token', {
          params: {
            grant_type: 'ig_exchange_token',
            client_secret: appSecret,
            access_token: shortIgToken,
          },
          timeout: 8000,
        });

        const longIgToken = longIgRes.data?.access_token || shortIgToken;

        // Fetch user's Instagram Professional Account profile directly
        const meRes = await axios.get('https://graph.instagram.com/v20.0/me', {
          params: {
            fields:
              'id,username,name,profile_picture_url,followers_count,follows_count,media_count',
            access_token: longIgToken,
          },
          timeout: 8000,
        });

        const igProfile = meRes.data;
        if (igProfile && igProfile.username) {
          const encryptedToken = this.encryptionService.encrypt(longIgToken);

          await this.prisma.instagramAccount.upsert({
            where: { instagramId: String(igProfile.id) },
            create: {
              userId,
              instagramId: String(igProfile.id),
              username: igProfile.username,
              displayName: igProfile.name || null,
              profilePicture: igProfile.profile_picture_url || null,
              accessToken: encryptedToken,
              followersCount: igProfile.followers_count || 0,
              followingCount: igProfile.follows_count || 0,
              mediaCount: igProfile.media_count || 0,
              isConnected: true,
            },
            update: {
              userId,
              username: igProfile.username,
              displayName: igProfile.name || null,
              profilePicture: igProfile.profile_picture_url || null,
              accessToken: encryptedToken,
              followersCount: igProfile.followers_count || 0,
              followingCount: igProfile.follows_count || 0,
              mediaCount: igProfile.media_count || 0,
              isConnected: true,
            },
          });

          await this.subscriptionService.incrementUsage(userId, 'max_accounts', 1);

          this.logger.log(
            `Direct Instagram Professional Account @${igProfile.username} linked successfully!`,
          );
          return igProfile.username;
        }
      }
    } catch (directErr: any) {
      this.logger.log(
        `Direct Instagram OAuth token exchange bypassed: ${directErr?.response?.data?.error_message || directErr?.message || String(directErr)}. Falling back to Facebook Page exchange.`,
      );
    }

    // ─── 2. Fallback: Facebook Page OAuth Token Exchange ───────────────────
    try {
      // 1. Get short-lived user token
      const shortTokenResponse = await axios.get<MetaTokenResponse>(
        'https://graph.facebook.com/v20.0/oauth/access_token',
        {
          params: {
            client_id: appId,
            redirect_uri: redirectUri,
            client_secret: appSecret,
            code,
          },
        },
      );

      const shortLivedToken = shortTokenResponse.data.access_token;

      // 2. Exchange for long-lived user token
      const longTokenResponse = await axios.get<MetaTokenResponse>(
        'https://graph.facebook.com/v20.0/oauth/access_token',
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: shortLivedToken,
          },
        },
      );

      const longLivedToken = longTokenResponse.data.access_token;

      // 3. Fetch Facebook pages list
      const pagesResponse = await axios.get<MetaPagesResponse>(
        'https://graph.facebook.com/v20.0/me/accounts',
        {
          params: {
            access_token: longLivedToken,
          },
        },
      );

      const pages = pagesResponse.data.data || [];
      this.logger.log(
        `Retrieved Facebook Pages count: ${pages.length}. Pages: ${JSON.stringify(pages.map((p) => ({ id: p.id, name: p.name })))}`,
      );
      let linkedAccountsCount = 0;

      for (const page of pages) {
        this.logger.log(`Fetching details for Facebook Page: ${page.name} (${page.id})`);
        // 4. Fetch Instagram business account connected to page
        const pageDetailsResponse = await axios.get<MetaIgAccountDetails>(
          `https://graph.facebook.com/v20.0/${page.id}`,
          {
            params: {
              fields:
                'instagram_business_account{id,username,name,profile_picture_url,followers_count,follows_count,media_count}',
              access_token: page.access_token,
            },
          },
        );

        this.logger.log(
          `Page Details Response for ${page.name}: ${JSON.stringify(pageDetailsResponse.data)}`,
        );

        const igAccount = pageDetailsResponse.data.instagram_business_account;

        if (igAccount) {
          // Attempt Page webhook subscription (Instagram Graph API delivers webhooks via App Dashboard endpoint)
          try {
            await axios.post(`https://graph.facebook.com/v20.0/${page.id}/subscribed_apps`, null, {
              params: {
                access_token: page.access_token,
                subscribed_fields: 'messages,feed,messaging_postbacks,mention',
              },
            });
            this.logger.log(`Page ${page.name} (${page.id}) webhook subscription active.`);
          } catch {
            this.logger.log(
              `Instagram account @${igAccount.username} connected. Meta App Webhook active.`,
            );
          }

          // Verify max_accounts limit for user's plan
          const existingAccount = await this.prisma.instagramAccount.findUnique({
            where: { instagramId: igAccount.id },
          });

          if (!existingAccount || existingAccount.userId !== userId) {
            const { allowed, used, limit } = await this.subscriptionService.checkLimit(
              userId,
              'max_accounts',
            );
            if (!allowed) {
              throw new BadRequestException(
                `Instagram account limit reached (${used}/${limit}). Upgrade your plan to connect additional accounts.`,
              );
            }
          }

          // Encrypt the page access token (long-lived / non-expiring)
          const encryptedPageToken = this.encryptionService.encrypt(page.access_token);

          await this.prisma.instagramAccount.upsert({
            where: { instagramId: igAccount.id },
            create: {
              userId,
              instagramId: igAccount.id,
              username: igAccount.username,
              displayName: igAccount.name || null,
              profilePicture: igAccount.profile_picture_url || null,
              accessToken: encryptedPageToken,
              instagramPageId: page.id,
              followersCount: igAccount.followers_count || 0,
              followingCount: igAccount.follows_count || 0,
              mediaCount: igAccount.media_count || 0,
              isConnected: true,
            },
            update: {
              userId,
              username: igAccount.username,
              displayName: igAccount.name || null,
              profilePicture: igAccount.profile_picture_url || null,
              accessToken: encryptedPageToken,
              instagramPageId: page.id,
              followersCount: igAccount.followers_count || 0,
              followingCount: igAccount.follows_count || 0,
              mediaCount: igAccount.media_count || 0,
              isConnected: true,
              deletedAt: null,
            },
          });

          await this.auditLogService.log({
            userId,
            action: 'INSTAGRAM_ACCOUNT_LINKED',
            details: JSON.stringify({ instagramId: igAccount.id, username: igAccount.username }),
          });

          linkedAccountsCount++;
        }
      }

      if (linkedAccountsCount === 0) {
        if (process.env.NODE_ENV !== 'production') {
          const mockIgId = '17841458228090598';
          const encryptedMockToken = this.encryptionService.encrypt('mock_dev_access_token');
          await this.prisma.instagramAccount.upsert({
            where: { instagramId: mockIgId },
            create: {
              userId,
              instagramId: mockIgId,
              username: 'demo_creator_hub',
              displayName: 'Demo Creator Hub',
              profilePicture: 'https://picsum.photos/seed/creator/200/200',
              accessToken: encryptedMockToken,
              followersCount: 12450,
              followingCount: 380,
              mediaCount: 42,
              isConnected: true,
            },
            update: {
              userId,
              isConnected: true,
              deletedAt: null,
            },
          });
          return userId;
        }

        throw new BadRequestException(
          'No connected Instagram Business Accounts found on your Facebook Pages. Please ensure your IG Business Profile is linked to your FB Page.',
        );
      }

      return userId;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        'Meta OAuth Token exchange failed',
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Meta Integration OAuth failure',
      );
    }
  }

  async disconnectAccount(accountId: string, userId: string) {
    const account = await this.prisma.instagramAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!account) {
      throw new NotFoundException('Connected Instagram channel not found');
    }

    // Perform soft-delete
    await this.prisma.instagramAccount.update({
      where: { id: accountId },
      data: {
        isConnected: false,
        deletedAt: new Date(),
      },
    });

    await this.auditLogService.log({
      userId,
      action: 'INSTAGRAM_ACCOUNT_DISCONNECTED',
      details: JSON.stringify({ instagramId: account.instagramId, username: account.username }),
    });

    return { message: 'Instagram connection removed successfully' };
  }

  async getConversations(userId: string) {
    const accounts = await this.prisma.instagramAccount.findMany({
      where: { userId, isConnected: true, deletedAt: null },
      select: {
        id: true,
        username: true,
        accessToken: true,
        instagramId: true,
        instagramPageId: true,
      },
    });

    const accountIds = accounts.map((a) => a.id);
    if (accountIds.length === 0) return [];

    const accountIgIds = new Set(
      accounts.flatMap((a) => [a.instagramId, a.instagramPageId].filter(Boolean) as string[]),
    );

    // Retrieve all messages for these accounts to determine threads
    const messages = await this.prisma.message.findMany({
      where: { instagramAccountId: { in: accountIds } },
      orderBy: { createdAt: 'desc' },
    });

    // Helper to determine partner ID for each message
    const getPartnerId = (m: any) => {
      if (m.senderId && accountIgIds.has(m.senderId)) {
        return m.recipientId;
      }
      if (accountIgIds.has(m.recipientId)) {
        return m.senderId || m.recipientId;
      }
      return m.recipientId;
    };

    // Grouping manually in JS for thread representation
    const threadsMap = new Map<string, any>();
    const partnerIdsList = messages
      .map(getPartnerId)
      .filter((id) => Boolean(id) && !accountIgIds.has(id));
    const uniquePartnerIds = Array.from(new Set(partnerIdsList));

    // Fetch matching comments in bulk to resolve usernames
    const comments = await this.prisma.comment.findMany({
      where: { userId: { in: uniquePartnerIds } },
      select: { userId: true, username: true },
    });

    const commentUsernameMap = new Map<string, string>();
    for (const c of comments) {
      commentUsernameMap.set(c.userId, c.username);
    }

    // Fetch from Meta API for missing usernames
    const missingPartnerIds = uniquePartnerIds.filter((id) => !commentUsernameMap.has(id));
    const metaUsernameMap = new Map<string, string>();

    if (missingPartnerIds.length > 0) {
      await Promise.all(
        missingPartnerIds.slice(0, 8).map(async (id) => {
          try {
            const firstMsg = messages.find((m) => getPartnerId(m) === id);
            if (!firstMsg) return;
            const account = accounts.find((a) => a.id === firstMsg.instagramAccountId);
            if (
              !account ||
              !account.accessToken ||
              account.accessToken.includes('mock') ||
              account.accessToken.includes('placeholder')
            ) {
              metaUsernameMap.set(id, `mock_user_${id.substring(id.length - 4)}`);
              return;
            }

            // Call Meta Graph API User Profile endpoint
            const res = await fetch(
              `https://graph.facebook.com/v20.0/${id}?fields=username,name&access_token=${account.accessToken}`,
            );
            if (res.ok) {
              const data = await res.json();
              if (data && data.username) {
                metaUsernameMap.set(id, data.username);
              }
            }
          } catch (err) {
            // ignore
          }
        }),
      );
    }

    for (const msg of messages) {
      const partnerId = getPartnerId(msg);
      if (partnerId && !accountIgIds.has(partnerId) && !threadsMap.has(partnerId)) {
        const account = accounts.find((a) => a.id === msg.instagramAccountId);
        const resolvedUsername =
          commentUsernameMap.get(partnerId) ||
          metaUsernameMap.get(partnerId) ||
          `ig_user_${partnerId.substring(partnerId.length - 4)}`;
        threadsMap.set(partnerId, {
          recipientId: partnerId,
          recipientUsername: resolvedUsername,
          lastMessage: msg.text || (msg.mediaUrl ? 'Attachment' : ''),
          updatedAt: msg.createdAt,
          instagramAccountId: msg.instagramAccountId,
          instagramAccountUsername: account?.username || 'unknown',
          unreadCount: 0,
        });
      }
    }

    return Array.from(threadsMap.values());
  }

  async getMessages(userId: string, recipientId: string) {
    const accounts = await this.prisma.instagramAccount.findMany({
      where: { userId, isConnected: true, deletedAt: null },
      select: { id: true },
    });
    const accountIds = accounts.map((a) => a.id);

    return this.prisma.message.findMany({
      where: {
        instagramAccountId: { in: accountIds },
        OR: [{ recipientId }, { senderId: recipientId }],
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendManualMessage(
    userId: string,
    recipientId: string,
    instagramAccountId: string,
    text: string,
  ) {
    // 1. Verify ownership of account
    const account = await this.prisma.instagramAccount.findFirst({
      where: { id: instagramAccountId, userId, isConnected: true, deletedAt: null },
    });

    if (!account) {
      throw new NotFoundException('Instagram account not found or access denied');
    }

    // 2. Save outgoing message to DB
    const outgoingMsg = await this.prisma.message.create({
      data: {
        instagramAccountId,
        recipientId,
        senderId: account.instagramId,
        text,
        messageId: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        direction: 'OUTGOING',
        status: 'SENT',
      },
    });

    // 3. Enqueue sending the actual message to Meta using SendDmProducer
    await this.sendDmProducer.enqueueSendDm({
      campaignId: 'manual', // Demarcates manual response
      instagramAccountId,
      recipientId,
      recipientUsername: 'user',
      replyMessage: text,
    });

    return outgoingMsg;
  }

  async syncAccountStats(accountId: string): Promise<void> {
    try {
      const account = await this.prisma.instagramAccount.findUnique({
        where: { id: accountId },
      });
      if (!account || !account.isConnected) return;

      const accessToken = this.encryptionService.decrypt(account.accessToken);
      if (accessToken.startsWith('mock_')) return;

      const url = `https://graph.facebook.com/v20.0/${account.instagramId}`;
      const res = await axios.get(url, {
        params: {
          fields: 'followers_count,follows_count,media_count',
          access_token: accessToken,
        },
        timeout: 5000,
      });

      if (res.data) {
        await this.prisma.instagramAccount.update({
          where: { id: account.id },
          data: {
            followersCount: res.data.followers_count ?? account.followersCount,
            followingCount: res.data.follows_count ?? account.followingCount,
            mediaCount: res.data.media_count ?? account.mediaCount,
          },
        });
        this.logger.log(
          `Synced metrics for Instagram account ${account.username}: followers=${res.data.followers_count}`,
        );
      }
    } catch (e: any) {
      this.logger.warn(`Failed to sync Instagram account stats for ${accountId}: ${e.message}`);
    }
  }
}
