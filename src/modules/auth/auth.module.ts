import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_FILTER } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { BullModule } from '@nestjs/bullmq'; 
import { PrismaModule } from '../../prisma/prisma.module';
import { QueuesModule } from '../queues/queues.module';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { AuthService } from './auth.service';
import { AccountLinkingService, ACCOUNT_REPOSITORY } from './services/account-linking.service';
import { TokenEncryptionService } from './services/token-encryption.service';
import { AccountRepository } from './repositories/account.repository';
import {
  TOKEN_ENCRYPTION_KEY,
  loadAuthEnvConfig,
  AuthEnvConfig,
  AUTH_ENV_CONFIG,
} from './config/auth.config';
import { TOKEN_CIPHER } from './interfaces/token-cipher.interface';
import { EMAIL_SENDER } from './interfaces/email-sender.interface';
import { MailService } from '../../mail/mail.service';
import { AUDIT_LOGGER } from './interfaces/audit-logger.interface';
import { PrismaAuditLogger } from './services/prisma-audit-logger.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { LinkedInStrategy } from './strategies/linkedin.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthExceptionFilter } from './filters/auth-exception.filter';
import { TwoFactorModule } from '../two-factor/two-factor.module';

/**
 * Synchronously loaded Auth environment configuration.
 */
const authEnvConfig = loadAuthEnvConfig();

@Module({
  imports: [
    PrismaModule,
    QueuesModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({ secret: authEnvConfig.jwtAccessSecret }),
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
    forwardRef(() => TwoFactorModule),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_ENV_CONFIG,
      useValue: authEnvConfig,
    },
    {
      provide: TOKEN_ENCRYPTION_KEY,
      useFactory: (config: AuthEnvConfig): Buffer => config.tokenEncryptionKey,
      inject: [AUTH_ENV_CONFIG],
    },
    AuthService,
    TokenEncryptionService,
    AccountRepository,
    {
      provide: TOKEN_CIPHER,
      useExisting: TokenEncryptionService,
    },
    {
      provide: ACCOUNT_REPOSITORY,
      useExisting: AccountRepository,
    },
    AccountLinkingService,
    PrismaAuditLogger,
    {
      provide: AUDIT_LOGGER,
      useExisting: PrismaAuditLogger,
    },
    {
      provide: EMAIL_SENDER,
      useClass: MailService,
    },
    GoogleStrategy,
    LinkedInStrategy,
    JwtStrategy,
    {
      provide: APP_FILTER,
      useClass: AuthExceptionFilter,
    },
  ],
  exports: [
    AuthService,
    AccountLinkingService,
    TokenEncryptionService,
    JwtModule,
    forwardRef(() => TwoFactorModule),
  ],
})
export class AuthModule {}