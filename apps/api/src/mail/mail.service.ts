import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { ConfigService } from '../config/config.service';
import { AppLogger } from '../common/logger/logger.service';

export type EmailSenderType = 'noreply' | 'receipts' | 'notifications' | 'support' | 'default';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  senderType?: EmailSenderType;
  replyTo?: string;
}

export interface PlanExpiringParams {
  to: string;
  creatorName?: string;
  planName: string;
  daysLeft: number;
  expiresAt: Date | string;
  renewUrl?: string;
}

export interface DmLimitParams {
  to: string;
  creatorName?: string;
  planName: string;
  usedDms: number;
  maxDms: number;
  upgradeUrl?: string;
  isWarning?: boolean;
}

export interface PaymentReceiptParams {
  to: string;
  creatorName?: string;
  invoiceId: string;
  amount: string | number;
  currency?: string;
  planName: string;
  billingCycle?: string;
  date?: string;
  receiptUrl?: string;
}

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private resend: Resend | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext('MailService');
  }

  private getDomain(): string {
    const rawDomain =
      this.configService.get('MAIL_DOMAIN') || process.env.MAIL_DOMAIN || 'dmpilot.org';
    return rawDomain
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .trim();
  }

  private getSupportEmail(): string | undefined {
    return this.configService.get('SUPPORT_EMAIL') || process.env.SUPPORT_EMAIL || undefined;
  }

  private resolveFromAddress(senderType: EmailSenderType = 'default'): string {
    const domain = this.getDomain();

    switch (senderType) {
      case 'noreply':
        return (
          this.configService.get('SMTP_FROM_NOREPLY') ||
          process.env.SMTP_FROM_NOREPLY ||
          `DMPilot <no-reply@${domain}>`
        );
      case 'receipts':
        return (
          this.configService.get('SMTP_FROM_BILLING') ||
          process.env.SMTP_FROM_BILLING ||
          `DMPilot Receipts <receipts@${domain}>`
        );
      case 'notifications':
        return (
          this.configService.get('SMTP_FROM_ALERTS') ||
          process.env.SMTP_FROM_ALERTS ||
          `DMPilot Notifications <notifications@${domain}>`
        );
      case 'support': {
        const support = this.getSupportEmail() || `support@${domain}`;
        return `DMPilot Support <${support}>`;
      }
      case 'default':
      default: {
        const customFrom = this.configService.get('SMTP_FROM') || process.env.SMTP_FROM;
        if (customFrom) return customFrom;
        const smtpUser = this.configService.get('SMTP_USER') || process.env.SMTP_USER;
        return smtpUser && !smtpUser.includes('resend')
          ? `DMPilot <${smtpUser}>`
          : `DMPilot <no-reply@${domain}>`;
      }
    }
  }

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    const smtpHost =
      this.configService.get('SMTP_HOST') || process.env.SMTP_HOST || 'smtp.resend.com';
    const smtpPort =
      Number(this.configService.get('SMTP_PORT')) || Number(process.env.SMTP_PORT) || 465;
    const smtpUser = this.configService.get('SMTP_USER') || process.env.SMTP_USER;
    const smtpPass = this.configService.get('SMTP_PASSWORD') || process.env.SMTP_PASSWORD;

    if (
      smtpUser &&
      smtpPass &&
      !smtpUser.includes('your_email@gmail.com') &&
      !smtpPass.includes('your_app_password')
    ) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
      this.logger.log(`SMTP Mail Transporter configured (${smtpUser} via ${smtpHost}:${smtpPort})`);
      return this.transporter;
    }

    return null;
  }

  private getResend(): Resend | null {
    if (this.resend) return this.resend;

    const resendApiKey =
      this.configService.get('RESEND_API_KEY') ||
      process.env.RESEND_API_KEY ||
      this.configService.get('SMTP_PASSWORD') ||
      process.env.SMTP_PASSWORD;

    if (resendApiKey && resendApiKey.startsWith('re_')) {
      this.resend = new Resend(resendApiKey);
      return this.resend;
    }
    return null;
  }

  /**
   * Universal email sender supporting both option objects and positional arguments.
   * Dispatches via SMTP (Nodemailer) with graceful fallback to Resend API.
   */
  async sendEmail(
    toOrOptions: string | SendEmailOptions,
    subject?: string,
    html?: string,
    text?: string,
    senderType: EmailSenderType = 'default',
  ): Promise<void> {
    let opts: SendEmailOptions;

    if (typeof toOrOptions === 'object') {
      opts = toOrOptions;
    } else {
      opts = {
        to: toOrOptions,
        subject: subject || '',
        html: html || '',
        text,
        senderType,
      };
    }

    const fromStr = this.resolveFromAddress(opts.senderType || 'default');
    const replyTo = opts.replyTo || this.getSupportEmail();
    const activeTransporter = this.getTransporter();

    // 1. Send via SMTP (Primary)
    if (activeTransporter) {
      try {
        await activeTransporter.sendMail({
          from: fromStr,
          to: opts.to,
          replyTo,
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
        });
        this.logger.log(`Email sent via SMTP (${fromStr}) to ${opts.to}`);
        return;
      } catch (smtpError) {
        this.logger.error(
          `SMTP email delivery failed to ${opts.to}: ${smtpError instanceof Error ? smtpError.message : smtpError}`,
        );
        // If SMTP fails, continue to Resend fallback
      }
    }

    // 2. Fallback to Resend API if SMTP fails or is unconfigured
    const activeResend = this.getResend();
    if (activeResend) {
      try {
        const { data, error } = await activeResend.emails.send({
          from: fromStr,
          to: [opts.to],
          reply_to: replyTo,
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
        });

        if (error) {
          throw new Error(error.message);
        }

        this.logger.log(`Email sent via Resend API successfully to ${opts.to} (id: ${data?.id})`);
        return;
      } catch (resendError) {
        this.logger.error(
          `Resend API delivery failed to ${opts.to}: ${resendError instanceof Error ? resendError.message : resendError}`,
        );
        throw resendError;
      }
    }

    // 3. Warning if neither SMTP nor Resend could send
    this.logger.warn(
      `Email not sent to ${opts.to}. Please check SMTP credentials (SMTP_USER/SMTP_PASSWORD) or RESEND_API_KEY in .env.`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HIGH-PRIORITY TRANSACTIONAL NOTIFICATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Alert creator when their subscription plan is approaching its expiration date.
   */
  async sendPlanExpiringEmail(params: PlanExpiringParams): Promise<void> {
    const rawAppUrl =
      this.configService.get('FRONTEND_URL') || process.env.FRONTEND_URL || 'https://dmpilot.org';
    const appUrl = rawAppUrl.toString().replace(/\/$/, '');
    const renewUrl = params.renewUrl || `${appUrl}/settings?tab=billing`;
    const formattedDate =
      typeof params.expiresAt === 'string'
        ? params.expiresAt
        : params.expiresAt.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

    const nameGreeting = params.creatorName ? `Hello ${params.creatorName},` : 'Hello Creator,';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; background-color: #f8fafc; line-height: 1.6;">
        <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, #00BB88 0%, #00887A 100%); padding: 24px 30px; text-align: left;">
            <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">DMPilot</h1>
          </div>

          <div style="padding: 30px;">
            <div style="display: inline-block; background-color: #fef3c7; color: #92400e; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
              ⚠️ Plan Expiration Alert
            </div>

            <h2 style="font-size: 20px; color: #0f172a; margin: 0 0 12px; font-weight: 700;">
              Your ${params.planName} plan expires in ${params.daysLeft} days
            </h2>

            <p style="font-size: 14px; color: #475569; margin: 0 0 20px;">
              ${nameGreeting} your current subscription is scheduled to expire on <strong>${formattedDate}</strong>.
            </p>

            <!-- Impact Notice Box -->
            <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 14px 16px; border-radius: 6px; margin-bottom: 24px;">
              <p style="font-size: 13px; color: #9a3412; margin: 0; font-weight: 500;">
                <strong>What happens if your plan expires?</strong><br/>
                Your active keyword automation campaigns will be paused and incoming Instagram comments won't receive automatic direct messages.
              </p>
            </div>

            <!-- CTA Button -->
            <div style="margin: 28px 0 24px;">
              <a href="${renewUrl}" style="display: block; width: fit-content; padding: 13px 28px; background: linear-gradient(135deg, #00BB88 0%, #00a377 100%); color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 8px; font-size: 14px; box-shadow: 0 2px 4px rgba(0, 187, 136, 0.3);">
                Renew Subscription & Keep Automating
              </a>
            </div>

            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />

            <p style="font-size: 12px; color: #64748b; margin: 0;">
              Have questions or need assistance with billing? Reply directly to this email to reach our team.
            </p>
          </div>
        </div>
      </div>
    `;

    const text = `DMPilot Alert: Your ${params.planName} plan expires in ${params.daysLeft} days (${formattedDate}). Renew at: ${renewUrl}`;

    await this.sendEmail({
      to: params.to,
      subject: `Action Required: Your DMPilot ${params.planName} plan expires in ${params.daysLeft} days`,
      html,
      text,
      senderType: 'notifications',
    });
  }

  /**
   * Alert creator when their automated DM quota is reached or near capacity.
   */
  async sendDmLimitReachedEmail(params: DmLimitParams): Promise<void> {
    const rawAppUrl =
      this.configService.get('FRONTEND_URL') || process.env.FRONTEND_URL || 'https://dmpilot.org';
    const appUrl = rawAppUrl.toString().replace(/\/$/, '');
    const upgradeUrl = params.upgradeUrl || `${appUrl}/settings?tab=billing`;
    const isWarning = params.isWarning ?? false;
    const nameGreeting = params.creatorName ? `Hello ${params.creatorName},` : 'Hello Creator,';

    const percentage = Math.min(100, Math.round((params.usedDms / params.maxDms) * 100));

    const badgeColor = isWarning ? '#fef3c7' : '#fee2e2';
    const badgeText = isWarning ? '#92400e' : '#991b1b';
    const badgeLabel = isWarning ? '⚡ 90% DM Quota Used' : '🚨 DM Limit Reached';

    const title = isWarning
      ? `You've used ${percentage}% of your monthly automated DMs`
      : `Your monthly DM limit has been reached`;

    const bodyText = isWarning
      ? `You've sent <strong>${params.usedDms.toLocaleString()}</strong> of your <strong>${params.maxDms.toLocaleString()}</strong> allocated DMs on the ${params.planName} plan.`
      : `You have reached the maximum <strong>${params.maxDms.toLocaleString()}</strong> automated DMs for your current billing cycle on the ${params.planName} plan.`;

    const impactText = isWarning
      ? 'To prevent your campaigns from halting during traffic spikes, upgrade your plan now.'
      : 'Automated comment responses and DMs are temporarily paused until your plan is upgraded or your billing cycle resets.';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; background-color: #f8fafc; line-height: 1.6;">
        <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 30px; text-align: left;">
            <h1 style="margin: 0; color: #00BB88; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">DMPilot</h1>
          </div>

          <div style="padding: 30px;">
            <div style="display: inline-block; background-color: ${badgeColor}; color: ${badgeText}; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
              ${badgeLabel}
            </div>

            <h2 style="font-size: 20px; color: #0f172a; margin: 0 0 12px; font-weight: 700;">
              ${title}
            </h2>

            <p style="font-size: 14px; color: #475569; margin: 0 0 20px;">
              ${nameGreeting} ${bodyText}
            </p>

            <!-- Usage Progress Bar Box -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 10px; margin-bottom: 24px;">
              <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 8px;">
                <span>Usage: ${params.usedDms.toLocaleString()} / ${params.maxDms.toLocaleString()} DMs</span>
                <span style="color: ${isWarning ? '#d97706' : '#dc2626'};">${percentage}%</span>
              </div>
              <div style="background-color: #e2e8f0; height: 10px; border-radius: 9999px; overflow: hidden;">
                <div style="background-color: ${isWarning ? '#f59e0b' : '#ef4444'}; height: 100%; width: ${percentage}%; border-radius: 9999px;"></div>
              </div>
              <p style="font-size: 12px; color: #64748b; margin: 10px 0 0;">
                ${impactText}
              </p>
            </div>

            <!-- CTA Button -->
            <div style="margin: 28px 0 24px;">
              <a href="${upgradeUrl}" style="display: block; width: fit-content; padding: 13px 28px; background: linear-gradient(135deg, #00BB88 0%, #00a377 100%); color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 8px; font-size: 14px; box-shadow: 0 2px 4px rgba(0, 187, 136, 0.3);">
                Upgrade Plan & Resume Automation
              </a>
            </div>

            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />

            <p style="font-size: 12px; color: #64748b; margin: 0;">
              Have custom volume requirements? Simply reply to this email for enterprise volume options.
            </p>
          </div>
        </div>
      </div>
    `;

    const text = `${title}. You have used ${params.usedDms}/${params.maxDms} DMs on the ${params.planName} plan. Upgrade at: ${upgradeUrl}`;

    await this.sendEmail({
      to: params.to,
      subject: isWarning
        ? `⚡ Heads up: 90% of your DMPilot monthly limit reached`
        : `🚨 Action Required: DMPilot limit reached for your account`,
      html,
      text,
      senderType: 'notifications',
    });
  }

  /**
   * Send a payment receipt / invoice confirmation to a creator.
   */
  async sendPaymentReceiptEmail(params: PaymentReceiptParams): Promise<void> {
    const rawAppUrl =
      this.configService.get('FRONTEND_URL') || process.env.FRONTEND_URL || 'https://dmpilot.org';
    const appUrl = rawAppUrl.toString().replace(/\/$/, '');
    const receiptUrl = params.receiptUrl || `${appUrl}/settings?tab=billing`;
    const currency = params.currency || 'USD';
    const dateStr =
      params.date ||
      new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    const nameGreeting = params.creatorName ? `Hello ${params.creatorName},` : 'Hello Creator,';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; background-color: #f8fafc; line-height: 1.6;">
        <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px 30px; text-align: left;">
            <h1 style="margin: 0; color: #00BB88; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">DMPilot</h1>
          </div>

          <div style="padding: 30px;">
            <div style="display: inline-block; background-color: #dcfce7; color: #166534; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">
              ✓ Payment Received
            </div>

            <h2 style="font-size: 20px; color: #0f172a; margin: 0 0 12px; font-weight: 700;">
              Thank you for your payment
            </h2>

            <p style="font-size: 14px; color: #475569; margin: 0 0 20px;">
              ${nameGreeting} your payment for the <strong>${params.planName}</strong> plan has been processed successfully.
            </p>

            <!-- Invoice Summary Table -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">Invoice ID:</td>
                  <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 6px 0;">${params.invoiceId}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">Date:</td>
                  <td style="color: #0f172a; text-align: right; padding: 6px 0;">${dateStr}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">Plan Tier:</td>
                  <td style="color: #0f172a; font-weight: 600; text-align: right; padding: 6px 0;">${params.planName} ${params.billingCycle ? `(${params.billingCycle})` : ''}</td>
                </tr>
                <tr style="border-top: 1px solid #e2e8f0;">
                  <td style="color: #0f172a; font-weight: 700; padding: 12px 0 0; font-size: 14px;">Total Paid:</td>
                  <td style="color: #059669; font-weight: 700; text-align: right; padding: 12px 0 0; font-size: 16px;">${currency} ${params.amount}</td>
                </tr>
              </table>
            </div>

            <!-- CTA Button -->
            <div style="margin: 28px 0 24px;">
              <a href="${receiptUrl}" style="display: block; width: fit-content; padding: 13px 28px; background: linear-gradient(135deg, #00BB88 0%, #00a377 100%); color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 8px; font-size: 14px; box-shadow: 0 2px 4px rgba(0, 187, 136, 0.3);">
                View Invoices & Billing
              </a>
            </div>

            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 24px 0;" />

            <p style="font-size: 12px; color: #64748b; margin: 0;">
              Need an updated tax ID on your invoice? Reply directly to this email and our billing team will assist you.
            </p>
          </div>
        </div>
      </div>
    `;

    const text = `Payment receipt for DMPilot ${params.planName}: ${currency} ${params.amount} (Invoice: ${params.invoiceId}). View receipt: ${receiptUrl}`;

    await this.sendEmail({
      to: params.to,
      subject: `Payment Receipt: ${params.planName} [${params.invoiceId}]`,
      html,
      text,
      senderType: 'receipts',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CORE AUTHENTICATION EMAILS
  // ─────────────────────────────────────────────────────────────────────────────

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const rawUrl =
      this.configService.get('FRONTEND_URL') || process.env.FRONTEND_URL || 'http://localhost:3000';
    const appUrl = rawUrl.toString().replace(/\/$/, '');
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; background-color: #f8fafc; line-height: 1.6;">
        <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <h2 style="color: #00BB88; margin: 0 0 16px; font-size: 20px; font-weight: 700;">Verify your Email Address</h2>
          <p style="font-size: 14px; color: #475569; margin: 0 0 24px;">
            Thank you for creating an account on DMPilot! Please click the button below to confirm your email address:
          </p>
          <div style="margin: 24px 0;">
            <a href="${verificationUrl}" style="display: inline-block; padding: 12px 26px; background: linear-gradient(135deg, #00BB88 0%, #00a377 100%); color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 8px; font-size: 14px; box-shadow: 0 2px 4px rgba(0, 187, 136, 0.3);">Verify Email Address</a>
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin: 24px 0 0;">
            If you did not sign up for DMPilot, you can safely ignore this email.
          </p>
        </div>
      </div>
    `;
    const text = `Verify your DMPilot Email at: ${verificationUrl}`;

    await this.sendEmail({
      to,
      subject: 'Verify your email address - DMPilot',
      html,
      text,
      senderType: 'noreply',
    });
  }

  async sendResetPasswordEmail(to: string, token: string): Promise<void> {
    const rawUrl =
      this.configService.get('FRONTEND_URL') || process.env.FRONTEND_URL || 'http://localhost:3000';
    const appUrl = rawUrl.toString().replace(/\/$/, '');
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; background-color: #f8fafc; line-height: 1.6;">
        <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <h2 style="color: #00BB88; margin: 0 0 16px; font-size: 20px; font-weight: 700;">Reset your Password</h2>
          <p style="font-size: 14px; color: #475569; margin: 0 0 24px;">
            We received a request to reset your DMPilot account password. Click the button below to choose a new password:
          </p>
          <div style="margin: 24px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 26px; background: linear-gradient(135deg, #00BB88 0%, #00a377 100%); color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 8px; font-size: 14px; box-shadow: 0 2px 4px rgba(0, 187, 136, 0.3);">Reset Password</a>
          </div>
          <p style="font-size: 12px; color: #94a3b8; margin: 24px 0 0;">
            This link expires in 1 hour. If you didn't request a password reset, you can safely disregard this message.
          </p>
        </div>
      </div>
    `;
    const text = `Reset your password at: ${resetUrl}`;

    await this.sendEmail({
      to,
      subject: 'Reset your password - DMPilot',
      html,
      text,
      senderType: 'noreply',
    });
  }
}
