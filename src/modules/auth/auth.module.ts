import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_FILTER } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { BullModule } from '@nestjs/bull';
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
 * Injection token for the fully-loaded, validated {@link AuthEnvConfig}.
 * Loaded exactly once at module initialization rather than re-read from
 * `process.env` throughout the module.
 */

/**
 * Loaded once, synchronously, when this file is first imported — see
 * prior commit history for why this is synchronous rather than an async
 * factory (circular DI issue with JwtModule.registerAsync).
 */
const authEnvConfig = loadAuthEnvConfig();

/**
 * Composition root for BOTH the pre-existing local email/password auth
 * system (AuthService, AuthController's register/login/etc. routes) and
 * the Social Logins OAuth module (Google/LinkedIn strategies,
 * AccountLinkingService). These live in one module because they share
 * one AuthController and one token-issuance mechanism
 * (AuthService.issueTokens / issueTokensForUserId) — OAuth logins do NOT
 * have their own separate refresh-token system; both paths write to the
 * same `RefreshToken` table via the same code path, avoiding the
 * raw-vs-hashed-token format conflict a separate OAuth-only token
 * service would have introduced.
 *
 * NOTE: JwtModule is registered synchronously (JwtModule.register), not
 * via JwtModule.registerAsync with an injected ConfigService — that
 * previously caused a circular DI issue (see authEnvConfig comment
 * above). Every JwtService.sign()/verify() call site in AuthService
 * passes its own explicit secret and expiresIn, so nothing depends on
 * this module-level config beyond needing a valid default at startup.
 */
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
