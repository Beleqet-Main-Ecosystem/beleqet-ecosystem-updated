import { Body, Controller, Get, HttpCode, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { LinkedInAuthGuard } from './guards/linkedin-auth.guard';
import { GoogleLinkAuthGuard } from './guards/google-link-auth.guard';
import { LinkedInLinkAuthGuard } from './guards/linkedin-link-auth.guard';
import { AccountLinkingService } from './services/account-linking.service';
import { TokenIssuanceService, TokenPair } from './services/token-issuance.service';
import { PreparedOAuthIdentity } from './interfaces/prepared-oauth-identity.interface';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { EMAIL_SENDER, IEmailSender } from './interfaces/email-sender.interface';
import { AUTH_ENV_CONFIG } from './config/auth.config';
import { AuthEnvConfig } from './config/auth.config';

/** Discriminated response shapes returned by the OAuth callback routes. */
type OAuthCallbackResponse =
  | { status: 'authenticated'; tokens: TokenPair }
  | { status: 'confirmation_required'; message: string };

/**
 * HTTP surface for the Social Logins module.
 *
 * Routes:
 * - `GET /auth/google`, `GET /auth/linkedin` — start the OAuth redirect.
 * - `GET /auth/google/callback`, `GET /auth/linkedin/callback` — complete
 *   sign-in. Returns issued tokens on success, or a confirmation-required
 *   response if the email matched an existing account (see
 *   {@link AccountLinkingService}).
 * - `GET /auth/google/link?token=...`, `GET /auth/linkedin/link?token=...`
 *   — re-authenticate with the provider to confirm a pending link,
 *   carrying the emailed confirmation token through as OAuth `state`.
 * - `POST /auth/refresh` — rotates a refresh token for a new pair.
 *
 * This controller intentionally contains the ONLY branching logic that
 * decides "is this a fresh sign-in or a link confirmation" — strategies
 * only prepare identity data (see {@link PreparedOAuthIdentity}), and
 * {@link AccountLinkingService} only knows the two individual operations.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly accountLinkingService: AccountLinkingService,
    private readonly tokenIssuanceService: TokenIssuanceService,
    @Inject(EMAIL_SENDER) private readonly emailSender: IEmailSender,
    @Inject(AUTH_ENV_CONFIG) private readonly config: AuthEnvConfig,
  ) {}

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  public googleLogin(): void {
    // Guard handles the redirect to Google; nothing to do here.
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  public async googleCallback(@Req() req: Request): Promise<OAuthCallbackResponse> {
    return this.handleOAuthCallback(req);
  }

  @Get('linkedin')
  @UseGuards(LinkedInAuthGuard)
  public linkedinLogin(): void {
    // Guard handles the redirect to LinkedIn; nothing to do here.
  }

  @Get('linkedin/callback')
  @UseGuards(LinkedInAuthGuard)
  public async linkedinCallback(@Req() req: Request): Promise<OAuthCallbackResponse> {
    return this.handleOAuthCallback(req);
  }

  @Get('google/link')
  @UseGuards(GoogleLinkAuthGuard)
  public googleLinkStart(): void {
    // Guard redirects to Google, carrying the confirmation token as state.
  }

  @Get('linkedin/link')
  @UseGuards(LinkedInLinkAuthGuard)
  public linkedinLinkStart(): void {
    // Guard redirects to LinkedIn, carrying the confirmation token as state.
  }

  /**
   * Rotates a refresh token for a new access/refresh pair.
   *
   * @remarks
   * Input validated via {@link RefreshTokenDto} (class-validator). Assumes
   * a global `ValidationPipe` is registered in `main.ts` — if not, add
   * `app.useGlobalPipes(new ValidationPipe())`.
   */
  @Post('refresh')
  @HttpCode(200)
  public async refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.tokenIssuanceService.rotateRefreshToken(dto.refreshToken);
  }

  /**
   * Shared logic for both providers' callback routes. Branches on
   * whether `state` is present in the query string:
   * - Present → this is a link-confirmation round-trip
   *   ({@link GoogleLinkAuthGuard} / {@link LinkedInLinkAuthGuard} set it).
   * - Absent → this is a normal sign-in/signup attempt.
   */
  private async handleOAuthCallback(req: Request): Promise<OAuthCallbackResponse> {
    const identity = req.user as PreparedOAuthIdentity;
    const confirmationToken = this.extractState(req);

    if (confirmationToken !== undefined) {
      const user = await this.accountLinkingService.confirmPendingLink(
        confirmationToken,
        identity.profile,
        identity.encryptedAccessToken,
        identity.encryptedRefreshToken,
      );
      const tokens = await this.tokenIssuanceService.issueTokenPair(user.id);
      return { status: 'authenticated', tokens };
    }

    const outcome = await this.accountLinkingService.handleOAuthSignIn(
      identity.profile,
      identity.encryptedAccessToken,
      identity.encryptedRefreshToken,
    );

    if (outcome.kind === 'PENDING_CONFIRMATION') {
      const linkPath = identity.profile.provider === 'GOOGLE' ? 'google' : 'linkedin';
      const confirmationUrl = `${this.config.appBaseUrl}/auth/${linkPath}/link?token=${outcome.confirmationToken}`;

      await this.emailSender.sendAccountLinkConfirmation(outcome.candidateEmail, confirmationUrl);

      // The token itself is never returned to the client — it only ever
      // reaches the user via the emailed link, closing off a vector where
      // a network observer or malicious frontend could steal it directly
      // from this response and complete the link without email access.
      return {
        status: 'confirmation_required',
        message:
          'An account with this email already exists. Check your email to confirm linking this provider.',
      };
    }

    const tokens = await this.tokenIssuanceService.issueTokenPair(outcome.user.id);
    return { status: 'authenticated', tokens };
  }

  private extractState(req: Request): string | undefined {
    const state = req.query.state;
    if (typeof state !== 'string' || !state.startsWith('link:')) {
      return undefined;
    }
    return state.slice('link:'.length);
  }
}
