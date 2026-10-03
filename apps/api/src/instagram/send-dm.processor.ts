import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import axios from 'axios';
import { QUEUE_NAMES } from '../queue/constants';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { SendDmPayload } from './send-dm.producer';
import { MessageDirection, MessageStatus } from '@prisma/client';

interface MetaSendMessageResponse {
  recipient_id: string;
  message_id: string;
}

@Processor(QUEUE_NAMES.SEND_DM)
export class SendDmProcessor extends WorkerHost {
  private readonly logger = new Logger(SendDmProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {
    super();
  }

  async process(job: Job<SendDmPayload>): Promise<void> {
    const {
      campaignId,
      instagramAccountId,
      recipientId,
      recipientUsername,
      commentId,
      igCommentId,
      replyMessage,
      replyMediaUrl,
    } = job.data;

    let targetRecipientId = recipientId;
    if (recipientId === '232323232' || recipientId === '12334') {
      targetRecipientId = '17841458228090598';
      this.logger.log(
        `[Developer Override] Overriding mock recipient ${recipientId} with test ID 17841458228090598`,
      );
    }

    this.logger.log(
      `[Job ${job.id}] Sending DM to @${recipientUsername} (${targetRecipientId}) for campaign ${campaignId}`,
    );

    // 1. Load account
    const account = await this.prisma.instagramAccount.findUnique({
      where: { id: instagramAccountId },
    });

    if (!account || !account.isConnected) {
      this.logger.warn(`Account ${instagramAccountId} not found or disconnected — aborting job.`);
      return;
    }

    // 1b. Load campaign details (if not manual)
    const campaign =
      campaignId !== 'manual'
        ? await this.prisma.campaign.findUnique({ where: { id: campaignId } })
        : null;

    // 2. Decrypt access token
    const accessToken = this.encryptionService.decrypt(account.accessToken);
    this.logger.log(
      `[Job ${job.id}] Decrypted token starts with: "${accessToken.substring(0, 10)}..." length=${accessToken.length}`,
    );

    // Resolve name from Meta Profile API to handle personalized templates ({name}, {username})
    let recipientName = recipientUsername;
    if (!accessToken.startsWith('mock_')) {
      for (const host of ['https://graph.instagram.com', 'https://graph.facebook.com']) {
        try {
          const profileRes = await axios.get(`${host}/v20.0/${targetRecipientId}`, {
            params: {
              fields: 'name',
              access_token: accessToken,
            },
            timeout: 5000,
          });
          if (profileRes.data?.name) {
            recipientName = profileRes.data.name;
            break;
          }
        } catch {
          // Continue to next host fallback
        }
      }
    }

    if (campaign?.type === 'COMMENT_REPLY') {
      this.logger.log(
        `[Job ${job.id}] COMMENT_REPLY type — skipping DM, posting public comment reply only.`,
      );

      if (commentId) {
        await this.prisma.comment.update({
          where: { id: commentId },
          data: {
            isReplied: true,
            replyText: `Public reply: ${campaign.commentReplyText?.slice(0, 50)}...`,
          },
        });
      }

      if (commentId && campaign.commentReplyText) {
        try {
          const triggeringComment = await this.prisma.comment.findUnique({
            where: { id: commentId },
          });

          if (triggeringComment?.commentId) {
            const personalizedCommentReply = campaign.commentReplyText
              .replace(/{username}/g, recipientUsername)
              .replace(/{name}/g, recipientName);

            if (accessToken.startsWith('mock_')) {
              this.logger.log(`[Job ${job.id}] Sandbox mode — mocking public comment reply.`);
            } else {
              let replySuccess = false;
              let lastReplyErr: any = null;
              for (const host of ['https://graph.instagram.com', 'https://graph.facebook.com']) {
                try {
                  const commentReplyUrl = `${host}/v20.0/${triggeringComment.commentId}/replies`;
                  this.logger.log(
                    `[Job ${job.id}] Posting public comment reply via: ${commentReplyUrl}`,
                  );
                  await axios.post(
                    commentReplyUrl,
                    { message: personalizedCommentReply },
                    {
                      params: { access_token: accessToken },
                      timeout: 10000,
                    },
                  );
                  replySuccess = true;
                  break;
                } catch (err: any) {
                  lastReplyErr = err;
                }
              }
              if (!replySuccess && lastReplyErr) {
                throw lastReplyErr;
              }
            }
            this.logger.log(`[Job ${job.id}] Successfully posted public comment reply.`);
          }
        } catch (replyError: any) {
          const metaError = replyError?.response?.data?.error?.message;
          this.logger.error(
            `[Job ${job.id}] Failed to post public comment reply: ${metaError || replyError.message}`,
          );
        }
      }
      return;
    }

    let isAlreadyFollowing = false;
    if (campaign?.followCheckEnabled && !job.data.isFollowBypass) {
      if (accessToken.startsWith('mock_')) {
        // In sandbox mock mode: simulate follower status based on recipient ID parity:
        // odd-ending IDs => already following, even-ending IDs => not following.
        const lastChar = targetRecipientId.slice(-1);
        const isOdd = !isNaN(Number(lastChar)) && Number(lastChar) % 2 !== 0;
        isAlreadyFollowing = isOdd;
        this.logger.log(
          `[Job ${job.id}] Sandbox Follow check: recipientId=${targetRecipientId} (already following: ${isAlreadyFollowing})`,
        );
      } else {
        // Live verification: Try fetching relationship details from Meta
        try {
          const checkRes = await axios.get(
            `https://graph.facebook.com/v20.0/${account.instagramId}/followers`,
            {
              params: {
                user_id: targetRecipientId,
                access_token: accessToken,
              },
              timeout: 5000,
            },
          );
          if (checkRes.data?.data && Array.isArray(checkRes.data.data)) {
            isAlreadyFollowing = checkRes.data.data.some((f: any) => f.id === targetRecipientId);
          }
        } catch (e: any) {
          this.logger.warn(
            `[Job ${job.id}] Meta Follow check failed/unsupported (requires app-review instagram_manage_insights permission): ${e.message}. Defaulting to prompt verification.`,
          );
        }
      }
    }

    const isPromptMode =
      campaign?.followCheckEnabled && !job.data.isFollowBypass && !isAlreadyFollowing;
    const followPromptText = `Hey @${recipientUsername}! Thanks for commenting. 🚀 First, make sure you follow @${account.username}, then tap the button below to get the link!`;

    // DM Variants Anti-Spam Auto-Rotation: If reply message contains pipe-separated copy variants, rotate per send
    let baseMessage = replyMessage;
    if (replyMessage && replyMessage.includes('|')) {
      const variants = replyMessage
        .split('|')
        .map((v) => v.trim())
        .filter(Boolean);
      if (variants.length > 0) {
        const sendSeed = parseInt((job.id || '').replace(/\D/g, ''), 10) || Date.now();
        baseMessage = variants[sendSeed % variants.length];
      }
    }

    const personalizedMessage = isPromptMode
      ? followPromptText
      : baseMessage.replace(/{username}/g, recipientUsername).replace(/{name}/g, recipientName);

    let messageId: string;
    let sendStatus: MessageStatus = MessageStatus.SENT;
    let errorMsg: string | null = null;

    // 3a. Sandbox mock path
    if (accessToken.startsWith('mock_')) {
      this.logger.log(
        `[Job ${job.id}] Sandbox mode — mocking Meta API send DM. isPromptMode=${isPromptMode} (already following: ${isAlreadyFollowing})`,
      );
      messageId = `mock_msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    } else {
      // 3b. Live Meta Graph API call — Instagram Messaging API
      // Docs: https://developers.facebook.com/docs/instagram-messaging/send-messages
      try {
        // Primary attempt: Private reply via comment_id if present, else direct message via recipient ID
        const primaryRecipientPayload: any = igCommentId
          ? { comment_id: igCommentId }
          : { id: targetRecipientId };

        const messagePayload: any = { text: personalizedMessage };
        if (isPromptMode) {
          messagePayload.quick_replies = [
            {
              content_type: 'text',
              title: 'I am following! 📖',
              payload: `CONFIRM_FOLLOW_CAMPAIGN_${campaignId}`,
            },
          ];
        }

        let response: any;
        const sendEndpointAttempt = async (baseMessagesUrl: string, recipientPayload: any) => {
          return await axios.post<MetaSendMessageResponse>(
            baseMessagesUrl,
            {
              recipient: recipientPayload,
              message: messagePayload,
            },
            {
              params: { access_token: accessToken },
              timeout: 10_000,
            },
          );
        };

        // Attempt graph.instagram.com (Direct IG Business Login) first, then fallback to graph.facebook.com
        const endpointsToTry = [
          'https://graph.instagram.com/v20.0/me/messages',
          'https://graph.facebook.com/v20.0/me/messages',
        ];

        let lastSendError: any = null;
        for (const url of endpointsToTry) {
          try {
            response = await sendEndpointAttempt(url, primaryRecipientPayload);
            break;
          } catch (firstErr: any) {
            lastSendError = firstErr;
            // If sending with comment_id failed on this endpoint, try with recipient id
            if (igCommentId) {
              try {
                this.logger.warn(
                  `[Job ${job.id}] Send via ${url} with comment_id failed (${firstErr?.response?.data?.error?.message || firstErr.message}). Retrying with recipient id ${targetRecipientId}...`,
                );
                response = await sendEndpointAttempt(url, { id: targetRecipientId });
                break;
              } catch (secondErr: any) {
                lastSendError = secondErr;
              }
            }
          }
        }

        if (!response) {
          throw lastSendError;
        }

        messageId = response.data.message_id;
        const fbtraceId = response.headers?.['x-fb-trace-id'] || null;

        if (job.data.webhookEventId) {
          await this.prisma.webhookEvent
            .update({
              where: { id: job.data.webhookEventId },
              data: {
                status: 'PROCESSED',
                fbtraceId,
              },
            })
            .catch(() => null);
        }
      } catch (error: any) {
        // Log the full Meta API error response for debugging
        const metaError = error?.response?.data?.error;
        const fbtraceId =
          metaError?.fbtrace_id || error?.response?.headers?.['x-fb-trace-id'] || null;

        let rawMsg = metaError?.message || (error instanceof Error ? error.message : String(error));

        // Format actionable Meta Dev Mode diagnostic explanation for developer
        if (metaError && metaError.code === 230) {
          rawMsg = `(#230) Meta Permission Error: Access token lacks instagram_manage_messages permissions. Re-connect your Instagram account in Dashboard and ensure all permission checkboxes are selected in Meta OAuth. Trace ID: ${fbtraceId || 'N/A'}`;
        } else if (
          metaError &&
          (metaError.code === 200 || metaError.code === 10 || metaError.code === 100)
        ) {
          rawMsg = `(#${metaError.code}) Meta Dev Mode Restriction: User @${recipientUsername} must be added as a Tester in Meta Developer Portal (App Roles) and accept the invite in Instagram Settings to receive DMs before App Review. Trace ID: ${fbtraceId || 'N/A'}`;
        } else if (metaError && metaError.code === 190) {
          rawMsg = `(#190) Meta Token/Dev Mode Error: ${metaError.message}. If in Dev Mode, ensure @${recipientUsername} is an accepted Tester in Meta App Roles. Trace ID: ${fbtraceId || 'N/A'}`;
        }

        this.logger.error(
          `[Job ${job.id}] Meta API failed for @${recipientUsername} (trace: ${fbtraceId}): ${rawMsg}`,
        );

        sendStatus = MessageStatus.FAILED;
        errorMsg = rawMsg;

        // Persist the FAILED message status and update WebhookEvent trace
        await this.prisma
          .$transaction(async (tx) => {
            await tx.message.create({
              data: {
                instagramAccountId: account.id,
                recipientId: targetRecipientId,
                senderId: account.instagramId,
                text: personalizedMessage,
                mediaUrl: replyMediaUrl ?? null,
                messageId: `failed_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                direction: MessageDirection.OUTGOING,
                status: MessageStatus.FAILED,
                errorMessage: errorMsg,
                fbtraceId,
                campaignId: campaignId === 'manual' ? null : campaignId,
              },
            });

            if (commentId) {
              await tx.comment.update({
                where: { id: commentId },
                data: {
                  isReplied: true,
                  replyText: `Failed: ${errorMsg}`,
                },
              });
            }

            if (job.data.webhookEventId) {
              await tx.webhookEvent.update({
                where: { id: job.data.webhookEventId },
                data: {
                  status: 'FAILED',
                  errorMessage: errorMsg,
                  fbtraceId,
                  commentId: igCommentId || commentId,
                  username: recipientUsername,
                },
              });
            }
          })
          .catch((dbErr) => {
            this.logger.error(
              `[Job ${job.id}] Failed to save failure state to DB: ${dbErr.message}`,
            );
          });

        // Determine if it is a temporary error (e.g. 5xx or network timeout/no response)
        const isTemporary = error.response ? error.response.status >= 500 : true;

        // Meta permission/authentication errors (code 200, 10, 190, 100) are permanent
        const isMetaPermissionError =
          metaError &&
          (metaError.code === 200 ||
            metaError.code === 10 ||
            metaError.code === 190 ||
            metaError.code === 100);

        if (isTemporary && !isMetaPermissionError) {
          // Re-throw so BullMQ will retry the job
          throw error;
        }

        // Otherwise return normally so the job completes successfully and isn't retried endlessly
        return;
      }
    }

    // 4. Persist success result in a transaction
    await this.prisma.$transaction(async (tx) => {
      // Save outgoing Message record
      await tx.message.create({
        data: {
          instagramAccountId: account.id,
          recipientId: targetRecipientId,
          senderId: account.instagramId,
          text: personalizedMessage,
          mediaUrl: replyMediaUrl ?? null,
          messageId,
          direction: MessageDirection.OUTGOING,
          status: sendStatus,
          errorMessage: errorMsg,
          campaignId: campaignId === 'manual' ? null : campaignId,
        },
      });

      // Mark the triggering Comment as replied (only if commentId is present)
      if (commentId) {
        await tx.comment.update({
          where: { id: commentId },
          data: {
            isReplied: true,
            replyText: replyMessage,
          },
        });
      }
    });

    this.logger.log(
      `[Job ${job.id}] DM delivered to @${recipientUsername} — messageId=${messageId}`,
    );

    // 5. Post public comment reply (outside DB transaction)
    if (
      sendStatus === MessageStatus.SENT &&
      commentId &&
      campaign?.commentReplyEnabled &&
      campaign.commentReplyText
    ) {
      try {
        const triggeringComment = await this.prisma.comment.findUnique({
          where: { id: commentId },
        });

        if (triggeringComment?.commentId) {
          const personalizedCommentReply = campaign.commentReplyText
            .replace(/{username}/g, recipientUsername)
            .replace(/{name}/g, recipientName);

          let replySuccess = false;
          let lastReplyErr: any = null;
          for (const host of ['https://graph.instagram.com', 'https://graph.facebook.com']) {
            try {
              const commentReplyUrl = `${host}/v20.0/${triggeringComment.commentId}/replies`;
              this.logger.log(
                `[Job ${job.id}] Posting public comment reply via: ${commentReplyUrl}`,
              );
              await axios.post(
                commentReplyUrl,
                { message: personalizedCommentReply },
                {
                  params: { access_token: accessToken },
                  timeout: 10000,
                },
              );
              replySuccess = true;
              break;
            } catch (err: any) {
              lastReplyErr = err;
            }
          }
          if (!replySuccess && lastReplyErr) {
            throw lastReplyErr;
          }
          this.logger.log(`[Job ${job.id}] Successfully posted public comment reply.`);
        }
      } catch (replyError: any) {
        const metaError = replyError?.response?.data?.error?.message;
        this.logger.error(
          `[Job ${job.id}] Failed to post public comment reply: ${metaError || replyError.message}`,
        );
      }
    }
  }
}
