import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_FILTER } from '@nestjs/core';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccountLinkingService, ACCOUNT_REPOSITORY } from './services/account-linking.service';
import { TokenEncryptionService } from './services/token-encryption.service';
import { TokenIssuanceService } from './services/token-issuance.service';
import { AccountRepository } from './repositories/account.repository';
import { RefreshTokenRepository } from './dto/refresh-token.repository';
import {
  TOKEN_ENCRYPTION_KEY,
  loadAuthEnvConfig,
  AuthEnvConfig,
  AUTH_ENV_CONFIG,
} from './config/auth.config';
import { TOKEN_CIPHER } from './interfaces/token-cipher.interface';
import { REFRESH_TOKEN_REPOSITORY } from './interfaces/refresh-token-repository.interface';
import { EMAIL_SENDER } from './interfaces/email-sender.interface';
import { MailService } from '../../mail/mail.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { LinkedInStrategy } from './strategies/linkedin.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthController } from './auth.controller';
import { AuthExceptionFilter } from './filters/auth-exception.filter';

/**
 * Injection token for the fully-loaded, validated {@link AuthEnvConfig}.
 * Loaded exactly once at module initialization rather than re-read from
 * `process.env` throughout the module.
 */

/**
 * Composition root for the Social Logins module. The ONLY file that
 * touches `process.env` (via {@link loadAuthEnvConfig}) or binds
 * abstract injection tokens to concrete implementations. Every other
 * file depends only on interfaces or receives validated values via
 * constructor injection — see each service's `.spec.ts` for how that's
 * exploited for dependency-free unit testing.
 *
 * `JwtModule` is configured here (not globally) so the access-token
 * secret stays scoped to this module rather than leaking into the rest
 * of the app's DI graph.
 */
const authEnvConfig = loadAuthEnvConfig();
@Module({
  imports: [PrismaModule, JwtModule.register({ secret: authEnvConfig.jwtAccessSecret })],
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
    // Register concrete classes once, then alias abstract tokens to the
    // SAME singleton via `useExisting` — avoids accidentally
    // instantiating two separate instances of one shared service.
    TokenEncryptionService,
    AccountRepository,
    RefreshTokenRepository,
    {
      provide: TOKEN_CIPHER,
      useExisting: TokenEncryptionService,
    },
    {
      provide: ACCOUNT_REPOSITORY,
      useExisting: AccountRepository,
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useExisting: RefreshTokenRepository,
    },
    AccountLinkingService,
    TokenIssuanceService,
    // Real SMTP mailer — no module import needed since MailService has
    // no external constructor deps (see src/mail/mail.config.ts).
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
  exports: [AccountLinkingService, TokenEncryptionService, TokenIssuanceService],
})
export class AuthModule {}
