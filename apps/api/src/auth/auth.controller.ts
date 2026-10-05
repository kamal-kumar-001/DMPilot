import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  ForgotPasswordDto,
  RefreshTokenDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth-requests.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GetUser } from './decorators/get-user.decorator';
import { ConfigService } from '../config/config.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() request: Request) {
    const ipAddress = request.ip || (request.headers['x-forwarded-for'] as string);
    const userAgent = request.headers['user-agent'];
    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto, @Req() request: Request) {
    const ipAddress = request.ip || (request.headers['x-forwarded-for'] as string);
    const userAgent = request.headers['user-agent'];
    return this.authService.refresh(refreshTokenDto, ipAddress, userAgent);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto) {
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body('email') email: string) {
    return this.authService.resendVerificationEmail(email);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.logout(refreshTokenDto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(
    @GetUser() user: { id: string; email: string; role: string; isVerified: boolean },
  ) {
    return user;
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @GetUser() user: { id: string },
    @Body() dto: { currentPassword?: string; newPassword?: string },
  ) {
    return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Post('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(@GetUser() user: { id: string }, @Body() dto: { name?: string }) {
    return this.authService.updateProfile(user.id, dto);
  }

  @Post('delete-request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createDeleteRequest(
    @GetUser() user: { id: string },
    @Body() dto: { reason: string; feedback?: string },
  ) {
    return this.authService.createDeleteRequest(user.id, dto.reason, dto.feedback);
  }

  @Delete('delete-request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancelDeleteRequest(@GetUser() user: { id: string }) {
    return this.authService.cancelDeleteRequest(user.id);
  }

  @Get('delete-request')
  @UseGuards(JwtAuthGuard)
  async getDeleteRequest(@GetUser() user: { id: string }) {
    return this.authService.getDeleteRequest(user.id);
  }

  @Post('deauthorize')
  @HttpCode(HttpStatus.OK)
  async deauthorize(@Body() body: any) {
    return { success: true, message: 'Deauthorized successfully' };
  }

  @Post('data-deletion')
  @HttpCode(HttpStatus.OK)
  async dataDeletion(@Body() body: any) {
    const result = await this.authService.handleMetaSignedRequestDataDeletion(body);
    const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://www.dmpilot.org';
    return {
      url: `${frontendUrl.replace(/\/$/, '')}/privacy?code=${result.confirmationCode}`,
      confirmation_code: result.confirmationCode,
    };
  }
}
