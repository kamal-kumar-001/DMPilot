import { BillingModule } from '../billing/billing.module';
import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuditLogService } from './audit-log.service';
import { ApiKeyService } from './api-key.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ConfigService } from '../config/config.service';

@Global()
@Module({
  imports: [
    BillingModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuditLogService, JwtStrategy, ApiKeyService, JwtAuthGuard],
  exports: [AuthService, JwtStrategy, PassportModule, AuditLogService, ApiKeyService, JwtAuthGuard],
})
export class AuthModule {}
