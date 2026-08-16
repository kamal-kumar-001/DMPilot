import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { ConfigService } from '../config/config.service';
import { AppLogger } from '../common/logger/logger.service';

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

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) return this.transporter;

    const smtpHost =
      this.configService.get('SMTP_HOST') || process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPort =
      Number(this.configService.get('SMTP_PORT')) || Number(process.env.SMTP_PORT) || 587;
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

    const resendApiKey = this.configService.get('RESEND_API_KEY') || process.env.RESEND_API_KEY;
    if (resendApiKey && resendApiKey.startsWith('re_') && !resendApiKey.includes('PruiYBpy')) {
      this.resend = new Resend(resendApiKey);
      return this.resend;
    }
    return null;
  }

  async sendEmail(to: string, subject: string, html: string, text?: string) {
    const smtpUser = this.configService.get('SMTP_USER') || process.env.SMTP_USER;
    const smtpFrom = this.configService.get('SMTP_FROM') || process.env.SMTP_FROM;
    const fromStr =
      smtpFrom || (smtpUser ? `DMPilot <${smtpUser}>` : 'DMPilot <onboarding@resend.dev>');

    const activeTransporter = this.getTransporter();

    // 1. Send via SMTP (Primary)
    if (activeTransporter) {
      try {
        await activeTransporter.sendMail({
          from: fromStr,
          to,
          subject,
          html,
          text,
        });
        this.logger.log(`Email sent via SMTP successfully to ${to}`);
        return;
      } catch (smtpError) {
        this.logger.error(
          `SMTP email delivery failed to ${to}: ${smtpError instanceof Error ? smtpError.message : smtpError}`,
        );
        throw new Error(
          `SMTP Delivery Failed: ${smtpError instanceof Error ? smtpError.message : 'Invalid SMTP credentials'}`,
        );
      }
    }

    // 2. Fallback to Resend API if SMTP is unconfigured
    const activeResend = this.getResend();
    if (activeResend) {
      try {
        const { data, error } = await activeResend.emails.send({
          from: fromStr,
          to: [to],
          subject,
          html,
          text,
        });

        if (error) {
          throw new Error(error.message);
        }

        this.logger.log(`Email sent via Resend API successfully to ${to} (id: ${data?.id})`);
        return;
      } catch (resendError) {
        this.logger.error(
          `Resend API delivery failed to ${to}: ${resendError instanceof Error ? resendError.message : resendError}`,
        );
        throw resendError;
      }
    }

    // 3. Warning if neither SMTP nor Resend is configured
    this.logger.warn(
      `Email not sent to ${to}. Please configure SMTP_USER (${smtpUser || 'not set'}) and SMTP_PASSWORD in .env.`,
    );
  }

  async sendVerificationEmail(to: string, token: string) {
    const rawUrl =
      this.configService.get('FRONTEND_URL') || process.env.FRONTEND_URL || 'http://localhost:3000';
    const appUrl = rawUrl.toString();
    const verificationUrl = `${appUrl.replace(/\/$/, '')}/verify-email?token=${token}`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #111827; background-color: #f9fafb;">
        <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e5e7eb;">
          <h2 style="color: #4f46e5; margin-top: 0;">Verify your Email Address</h2>
          <p style="font-size: 14px; color: #374151; line-height: 1.5;">
            Thank you for registering with DMPilot! Please click the button below to verify your email address:
          </p>
          <div style="margin: 25px 0;">
            <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: #ffffff; font-weight: bold; text-decoration: none; border-radius: 8px; font-size: 14px;">Verify Email Address</a>
          </div>
          <p style="font-size: 12px; color: #6b7280;">
            If you did not request this verification email, please disregard this message.
          </p>
        </div>
      </div>
    `;
    const text = `Verify your DMPilot Email at: ${verificationUrl}`;
    await this.sendEmail(to, 'Verify your email address - DMPilot', html, text);
  }

  async sendResetPasswordEmail(to: string, token: string) {
    const rawUrl =
      this.configService.get('FRONTEND_URL') || process.env.FRONTEND_URL || 'http://localhost:3000';
    const appUrl = rawUrl.toString();
    const resetUrl = `${appUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #111827; background-color: #f9fafb;">
        <div style="max-width: 500px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 12px; border: 1px solid #e5e7eb;">
          <h2 style="color: #4f46e5; margin-top: 0;">Reset your Password</h2>
          <p style="font-size: 14px; color: #374151; line-height: 1.5;">
            We received a request to reset your DMPilot account password. Click the button below to update your password:
          </p>
          <div style="margin: 25px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: #ffffff; font-weight: bold; text-decoration: none; border-radius: 8px; font-size: 14px;">Reset Password</a>
          </div>
          <p style="font-size: 12px; color: #6b7280;">
            This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.
          </p>
        </div>
      </div>
    `;
    const text = `Reset your password at: ${resetUrl}`;
    await this.sendEmail(to, 'Reset your password - DMPilot', html, text);
  }
}
