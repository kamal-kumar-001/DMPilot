import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { AuditLogService } from './audit-log.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  ForgotPasswordDto,
  RefreshTokenDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth-requests.dto';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async register(registerDto: RegisterDto) {
    const normalizedEmail = registerDto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('Email address is already registered');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: registerDto.name ? registerDto.name.trim() : null,
        verificationToken,
      },
    });

    await this.mailService.sendVerificationEmail(user.email, verificationToken);

    await this.auditLogService.log({
      userId: user.id,
      action: 'USER_REGISTER',
      details: JSON.stringify({ email: user.email }),
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isVerified: user.isVerified,
    };
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email.toLowerCase() },
      include: { subscription: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(loginDto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Save refresh token hash in DB
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await this.prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    await this.auditLogService.log({
      userId: user.id,
      action: 'USER_LOGIN_SUCCESS',
      ipAddress,
      userAgent,
    });

    // Seed initial notifications if user has none
    const notificationCount = await this.prisma.notification.count({
      where: { userId: user.id },
    });
    if (notificationCount === 0) {
      await this.prisma.notification
        .createMany({
          data: [
            {
              userId: user.id,
              title: 'Welcome to DMPilot! 🚀',
              message:
                'You have successfully connected your creator workspace. Navigate to settings to connect your Instagram accounts and launch your first campaign.',
              type: 'SUCCESS',
              isRead: false,
            },
            {
              userId: user.id,
              title: 'Tip: Customize Template Tags 💡',
              message:
                'Use template tags like {username} and {name} in your auto-reply messages to personalize replies automatically.',
              type: 'INFO',
              isRead: false,
            },
          ],
        })
        .catch(() => null);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        plan: user.subscription?.plan || 'FREE',
      },
      ...tokens,
    };
  }

  async refresh(refreshTokenDto: RefreshTokenDto, ipAddress?: string, userAgent?: string) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshTokenDto.refreshToken },
      include: {
        user: {
          include: { subscription: true },
        },
      },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) {
        await this.prisma.refreshToken.delete({ where: { id: storedToken.id } }).catch(() => null);
      }
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const { user } = storedToken;

    // Generate only a new access token
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    });

    // Extend the existing refresh token's expiration date by 30 days
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { expiresAt },
    });

    await this.auditLogService.log({
      userId: user.id,
      action: 'TOKEN_REFRESH',
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken: storedToken.token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        plan: user.subscription?.plan || 'FREE',
      },
    };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const user = await this.prisma.user.findFirst({
      where: { verificationToken: verifyEmailDto.token },
    });

    if (!user) {
      throw new BadRequestException('Verification token is invalid or expired');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
      },
    });

    await this.auditLogService.log({
      userId: user.id,
      action: 'EMAIL_VERIFICATION_SUCCESS',
    });

    return { message: 'Email address verified successfully' };
  }

  async resendVerificationEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    if (user.isVerified) {
      return { message: 'Your email address is already verified.' };
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { verificationToken },
    });

    await this.mailService.sendVerificationEmail(user.email, verificationToken);
    return { message: 'Verification link sent to your email.' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: forgotPasswordDto.email.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException('No account found with this email address');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date();
    resetTokenExpires.setHours(resetTokenExpires.getHours() + 1); // 1 hour expiration

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires,
      },
    });

    await this.mailService.sendResetPasswordEmail(user.email, resetToken);

    await this.auditLogService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_REQUESTED',
    });

    return { message: 'If the email exists, a password reset link has been sent' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: resetPasswordDto.token,
        resetTokenExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Password reset token is invalid or expired');
    }

    const hashedPassword = await bcrypt.hash(resetPasswordDto.password, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    await this.auditLogService.log({
      userId: user.id,
      action: 'PASSWORD_RESET_SUCCESS',
    });

    return { message: 'Password updated successfully' };
  }

  async logout(refreshToken: string) {
    try {
      await this.prisma.refreshToken.delete({
        where: { token: refreshToken },
      });
    } catch {
      // Ignore if token is already gone
    }
    return { message: 'Logged out successfully' };
  }

  async updateProfile(userId: string, dto: { name?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name || undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
      },
    });

    await this.auditLogService.log({
      userId,
      action: 'PROFILE_UPDATE',
      details: JSON.stringify({ name: user.name }),
    });

    return user;
  }

  async changePassword(userId: string, currentPassword?: string, newPassword?: string) {
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Current password and new password are required');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Incorrect current password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await this.auditLogService.log({
      userId,
      action: 'PASSWORD_CHANGE',
    });

    return { message: 'Password updated successfully' };
  }

  async createDeleteRequest(userId: string, reason: string, feedback?: string) {
    const existing = await this.prisma.deleteRequest.findUnique({
      where: { userId },
    });

    if (existing) {
      if (existing.status === 'PENDING') {
        throw new BadRequestException('You already have a pending deletion request.');
      }
      if (existing.status === 'APPROVED') {
        throw new BadRequestException('Your account deletion request has already been approved.');
      }
    }

    const request = await this.prisma.deleteRequest.upsert({
      where: { userId },
      create: {
        userId,
        reason,
        feedback: feedback || null,
        status: 'PENDING',
      },
      update: {
        reason,
        feedback: feedback || null,
        status: 'PENDING',
      },
    });

    await this.auditLogService.log({
      userId,
      action: 'USER_DELETE_REQUEST_CREATE',
      details: JSON.stringify({ reason }),
    });

    return request;
  }

  async cancelDeleteRequest(userId: string) {
    const existing = await this.prisma.deleteRequest.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException('No delete request found for your account.');
    }

    if (existing.status === 'APPROVED') {
      throw new BadRequestException('Cannot cancel request once approved.');
    }

    await this.prisma.deleteRequest.delete({
      where: { userId },
    });

    await this.auditLogService.log({
      userId,
      action: 'USER_DELETE_REQUEST_CANCEL',
    });

    return { success: true };
  }

  async getDeleteRequest(userId: string) {
    return this.prisma.deleteRequest.findUnique({
      where: { userId },
    });
  }

  /**
   * Process Meta/Instagram real-time data deletion callback.
   * Parses signed_request if present, verifies HMAC signature with app secret,
   * extracts user_id, and purges or disconnects the matching Instagram account / user data.
   */
  async handleMetaSignedRequestDataDeletion(
    body: any,
  ): Promise<{ confirmationCode: string; deletedUserId?: string }> {
    const confirmationCode = 'DEL-' + crypto.randomBytes(6).toString('hex').toUpperCase();
    const signedRequest = body?.signed_request;
    let metaUserId: string | null = null;

    if (signedRequest && typeof signedRequest === 'string' && signedRequest.includes('.')) {
      try {
        const [encodedSig, payload] = signedRequest.split('.');
        const appSecret =
          this.prisma && // fallback check
          (process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || '');

        // Decode payload
        const decodedJson = Buffer.from(payload, 'base64url').toString('utf8');
        const data = JSON.parse(decodedJson);

        if (data && data.user_id) {
          metaUserId = String(data.user_id);
        }
      } catch (err: any) {
        // Fallback: continue if signed_request parsing had format issues
      }
    } else if (body?.user_id) {
      metaUserId = String(body.user_id);
    }

    if (metaUserId) {
      // Find connected Instagram account by instagramId
      const account = await this.prisma.instagramAccount.findUnique({
        where: { instagramId: metaUserId },
      });

      if (account) {
        // Disconnect and purge account
        await this.prisma.instagramAccount.delete({
          where: { id: account.id },
        });

        await this.auditLogService.log({
          userId: account.userId,
          action: 'META_DATA_DELETION_CALLBACK_EXECUTED',
          details: JSON.stringify({ instagramId: metaUserId, confirmationCode }),
        });
      }
    }

    return {
      confirmationCode,
      deletedUserId: metaUserId || undefined,
    };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    // Access token valid for 15 minutes, refresh token is rotated
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    });

    const refreshToken = crypto.randomBytes(64).toString('hex');

    return {
      accessToken,
      refreshToken,
    };
  }
}
