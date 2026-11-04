import { BillingModule } from '../billing/billing.module';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuditLogService } from './audit-log.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ConfigService } from '../config/config.service';

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
  providers: [AuthService, AuditLogService, JwtStrategy],
  exports: [AuthService, JwtStrategy, PassportModule, AuditLogService],
})
export class AuthModule {}
