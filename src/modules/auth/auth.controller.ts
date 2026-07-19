// auth.controller.ts
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Request,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  ChangeEmailDto,
} from './dto/register.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { LinkedInAuthGuard } from './guards/linkedin-auth.guard';
import { GoogleLinkAuthGuard } from './guards/google-link-auth.guard';
import { LinkedInLinkAuthGuard } from './guards/linkedin-link-auth.guard';
import { AccountLinkingService } from './services/account-linking.service';
import { PreparedOAuthIdentity } from './interfaces/prepared-oauth-identity.interface';
import { EMAIL_SENDER, IEmailSender } from './interfaces/email-sender.interface';
import { AUTH_ENV_CONFIG, AuthEnvConfig } from './config/auth.config';

/** Discriminated response shapes returned by the OAuth callback routes. */
type OAuthCallbackResponse =
  | { status: 'authenticated'; tokens: { accessToken: string; refreshToken: string } }
  | { status: 'confirmation_required'; message: string };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly accountLinkingService: AccountLinkingService,
    @Inject(EMAIL_SENDER) private readonly emailSender: IEmailSender,
    @Inject(AUTH_ENV_CONFIG) private readonly config: AuthEnvConfig,
  ) {}

  // ─── Pre-existing local email/password auth (unchanged) ──────────────────

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive JWT tokens' })
  async login(@Body() dto: LoginDto, @Request() req: any) {
    const user = await this.authService.validateUser(dto.email, dto.password);
    const userAgent = req.headers['user-agent'];
    return this.authService.login(user, userAgent);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshDto) {
    // Single unified refresh path for BOTH local and OAuth-issued tokens —
    // see AuthService.issueTokens / issueTokensForUserId. Do not add a
    // second /auth/refresh handler; the OAuth module previously had its
    // own TokenIssuanceService.rotateRefreshToken doing this via a
    // different (SHA-256 hashed) token storage format, which is
    // incompatible with this one and has been removed in favor of this
    // single source of truth.
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  logout(@Request() req: Express.Request & { user: { userId: string } }) {
    return this.authService.logout(req.user.userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user profile' })
  me(@Request() req: Express.Request & { user: { userId: string; email: string; role: string } }) {
    return req.user;
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify user email via token' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password via token' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password (requires step-up if 2FA is enabled)' })
  changePassword(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ChangePasswordDto,
    @Headers('x-step-up-token') stepUpToken?: string,
  ) {
    return this.authService.changePassword(user.userId, dto, stepUpToken);
  }

  @Post('change-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change email (requires step-up if 2FA is enabled)' })
  changeEmail(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ChangeEmailDto,
    @Headers('x-step-up-token') stepUpToken?: string,
  ) {
    return this.authService.changeEmail(user.userId, dto, stepUpToken);
  }

  // ─── Social Logins (Google + LinkedIn OAuth/OIDC) ─────────────────────────

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Start Google OAuth sign-in' })
  googleLogin(): void {
    // Guard handles the redirect to Google; nothing to do here.
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: ExpressRequest): Promise<OAuthCallbackResponse> {
    return this.handleOAuthCallback(req);
  }

  @Get('linkedin')
  @UseGuards(LinkedInAuthGuard)
  @ApiOperation({ summary: 'Start LinkedIn OIDC sign-in' })
  linkedinLogin(): void {
    // Guard handles the redirect to LinkedIn; nothing to do here.
  }

  @Get('linkedin/callback')
  @UseGuards(LinkedInAuthGuard)
  async linkedinCallback(@Req() req: ExpressRequest): Promise<OAuthCallbackResponse> {
    return this.handleOAuthCallback(req);
  }

  @Get('google/link')
  @UseGuards(GoogleLinkAuthGuard)
  googleLinkStart(): void {
    // Guard redirects to Google, carrying the confirmation token as state.
  }

  @Get('linkedin/link')
  @UseGuards(LinkedInLinkAuthGuard)
  linkedinLinkStart(): void {
    // Guard redirects to LinkedIn, carrying the confirmation token as state.
  }

  private async handleOAuthCallback(req: ExpressRequest): Promise<OAuthCallbackResponse> {
    const identity = req.user as PreparedOAuthIdentity;
    const confirmationToken = this.extractState(req);

    if (confirmationToken !== undefined) {
      const user = await this.accountLinkingService.confirmPendingLink(
        confirmationToken,
        identity.profile,
        identity.encryptedAccessToken,
        identity.encryptedRefreshToken,
      );
      const tokens = await this.authService.issueTokensForUserId(user.id);
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

      // Fire-and-forget: matches the existing pattern in AuthService for
      // all other transactional emails (welcome, login/logout alerts,
      // etc.) — the SMTP handshake (often 1-3s) must not block this
      // request/redirect. A delivery failure here is logged, not
      // surfaced to the user, since the confirmation flow itself already
      // succeeded; the user can request a fresh link if the email never
      // arrives.
      this.emailSender
        .sendAccountLinkConfirmation(outcome.candidateEmail, confirmationUrl)
        .catch((err: Error) =>
          this.logger.error(
            `Failed to send account-link confirmation email to ${outcome.candidateEmail}: ${err.message}`,
          ),
        );

      return {
        status: 'confirmation_required',
        message:
          'An account with this email already exists. Check your email to confirm linking this provider.',
      };
    }

    const tokens = await this.authService.issueTokensForUserId(outcome.user.id);
    return { status: 'authenticated', tokens };
  }

  private extractState(req: ExpressRequest): string | undefined {
    const state = req.query.state;
    if (typeof state !== 'string' || !state.startsWith('link:')) {
      return undefined;
    }
    return state.slice('link:'.length);
  }
}
