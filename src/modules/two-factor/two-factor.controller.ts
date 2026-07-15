import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { TwoFactorService } from './two-factor.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ConfirmEnrollmentDto,
  VerifyDto,
  BackupCodeDto,
  StepUpDto,
  ChallengeDto,
  Disable2faDto,
} from './dto/two-factor.dto';

const TOKEN_PURPOSE = {
  LOGIN: '2fa_login',
  ENROLLMENT: '2fa_enrollment',
  STEP_UP_CHALLENGE: '2fa_step_up_challenge',
  STEP_UP_VERIFIED: '2fa_step_up',
  BACKUP_CODE_LOGIN: '2fa_backup_code_login',
} as const;

@ApiTags('auth')
@Controller('auth/2fa')
export class TwoFactorController {
  private readonly tempSecret: string;

  constructor(
    private readonly svc: TwoFactorService,
    private readonly jwt: JwtService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const ts = config.get<string>('TOTP_TEMP_SECRET');
    if (!ts) {
      throw new Error(
        'TOTP_TEMP_SECRET is required. Set it in your environment variables.',
      );
    }
    this.tempSecret = ts;
  }

  /** Initiate 2FA enrollment — generates and returns a provisioning URI (otpauth://)
   *  for the user to scan with their authenticator app, along with a time-limited
   *  enrollment token required to confirm the setup. */
  @Post('enroll')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start 2FA enrollment — returns provisioning URI and enrollment token' })
  startEnrollment(@CurrentUser() user: CurrentUserPayload) {
    return this.svc.startEnrollment(user.userId);
  }

  /** Confirm 2FA enrollment by validating the 6-digit TOTP code from the user's
   *  authenticator app. On success, enables 2FA and returns 10 single-use backup codes. */
  @Post('confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm 2FA enrollment with TOTP code' })
  confirmEnrollment(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ConfirmEnrollmentDto,
  ) {
    return this.svc.confirmEnrollment(user.userId, dto.enrollmentToken, dto.code);
  }

  /** Verify a TOTP code to complete the login flow. Expects a temp token (obtained
   *  from the login endpoint) with purpose `2fa_login` and a 6-digit code.
   *  On success, issues full JWT tokens. */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @ApiOperation({ summary: 'Verify 2FA code to complete login' })
  async verify(@Body() dto: VerifyDto) {
    let payload: { sub: string; purpose: string };
    try {
      payload = this.jwt.verify(dto.tempToken, { secret: this.tempSecret }) as any;
    } catch {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    if (payload.purpose !== TOKEN_PURPOSE.LOGIN) {
      throw new UnauthorizedException(
        `Invalid token purpose: expected ${TOKEN_PURPOSE.LOGIN}`,
      );
    }

    const isValid = await this.svc.verifyLogin(payload.sub, dto.code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid code');
    }

    const userRecord = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    if (!userRecord) {
      throw new UnauthorizedException('User not found');
    }

    return this.authService.issueTokens(userRecord);
  }

  /** Generate an action-scoped step-up challenge token for a specific sensitive action.
   *  This allows clients to request a challenge that is bound to a particular action
   *  and resource, providing stronger security than the generic guard-generated challenge. */
  @Post('challenge')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @ApiOperation({ summary: 'Request an action-scoped step-up challenge token' })
  requestChallenge(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ChallengeDto,
  ) {
    const challengeToken = this.jwt.sign(
      {
        sub: user.userId,
        purpose: TOKEN_PURPOSE.STEP_UP_CHALLENGE,
        action: dto.action,
        resourceId: dto.resourceId ?? null,
        iat: Math.floor(Date.now() / 1000),
      },
      { secret: this.tempSecret, expiresIn: '5m' },
    );

    return { stepUpToken: challengeToken };
  }

  /** Perform step-up verification for sensitive actions (e.g., wallet withdrawal,
   *  escrow release). Requires a step-up challenge token (purpose `2fa_step_up_challenge`)
   *  and a valid 6-digit TOTP code. If the challenge token was action-scoped, the
   *  request body must include matching `action` and `resourceId`.
   *  Returns a short-lived step-up JWT with a `2fa_verified_at` claim. */
  @Post('step-up')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @ApiOperation({ summary: 'Step-up verification for sensitive actions' })
  async stepUp(@Body() dto: StepUpDto) {
    let payload: Record<string, any>;
    try {
      payload = this.jwt.verify(dto.stepUpToken, { secret: this.tempSecret }) as any;
    } catch {
      throw new UnauthorizedException('Invalid or expired step-up token');
    }

    if (payload.purpose !== TOKEN_PURPOSE.STEP_UP_CHALLENGE) {
      throw new BadRequestException(
        `Invalid token purpose: expected ${TOKEN_PURPOSE.STEP_UP_CHALLENGE}`,
      );
    }

    if (payload.action && payload.action !== 'sensitive_action') {
      if (!dto.action) {
        throw new BadRequestException(
          `Challenge token is scoped to action "${payload.action}" but request did not specify an action`,
        );
      }
      if (payload.action !== dto.action) {
        throw new BadRequestException(
          `Challenge token scoped to action "${payload.action}" but request specified "${dto.action}"`,
        );
      }
      if (payload.resourceId && dto.resourceId && payload.resourceId !== dto.resourceId) {
        throw new BadRequestException(
          `Challenge token scoped to resource "${payload.resourceId}" but request specified "${dto.resourceId}"`,
        );
      }
    }

    const stepUpToken = await this.svc.verifyStepUp(
      payload.sub, dto.code,
      payload.action !== 'sensitive_action' ? payload.action : undefined,
      payload.resourceId,
    );

    return { stepUpToken };
  }

  /** Complete login using a backup code instead of a TOTP code. Backup codes are
   *  single-use; the consumed code is marked as used. On success, issues full JWT tokens. */
  @Post('backup-code')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @ApiOperation({ summary: 'Use a backup code to complete login' })
  async backupCode(@Body() dto: BackupCodeDto) {
    let payload: { sub: string; purpose: string };
    try {
      payload = this.jwt.verify(dto.tempToken, { secret: this.tempSecret }) as any;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (payload.purpose !== TOKEN_PURPOSE.LOGIN) {
      throw new UnauthorizedException(
        `Invalid token purpose: expected ${TOKEN_PURPOSE.LOGIN}`,
      );
    }

    const remaining = await this.svc.verifyBackupCode(payload.sub, dto.backupCode);

    const userRecord = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    if (!userRecord) throw new UnauthorizedException('User not found');

    const tokens = await this.authService.issueTokens(userRecord);
    return {
      ...tokens,
      remainingBackupCodes: remaining,
    };
  }

  /** Regenerate the full set of 10 backup codes. Requires a valid step-up challenge
   *  token (obtained via the challenge endpoint or guard) to verify the user's identity. */
  @Post('backup-codes/regenerate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerate backup codes (requires OTP verification)' })
  async regenerateBackupCodes(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: StepUpDto,
  ) {
    let payload: Record<string, any>;
    try {
      payload = this.jwt.verify(dto.stepUpToken, { secret: this.tempSecret }) as any;
    } catch {
      throw new UnauthorizedException('Invalid or expired step-up token');
    }

    if (payload.purpose !== TOKEN_PURPOSE.STEP_UP_CHALLENGE) {
      throw new BadRequestException(
        `Invalid token purpose: expected ${TOKEN_PURPOSE.STEP_UP_CHALLENGE}`,
      );
    }

    if (payload.sub !== user.userId) {
      throw new UnauthorizedException('Token does not match current user');
    }

    await this.svc.verifyStepUp(
      user.userId, dto.code,
      payload.action !== 'sensitive_action' ? payload.action : undefined,
      payload.resourceId,
    );
    const codes = await this.svc.regenerateBackupCodes(user.userId);

    return { backupCodes: codes };
  }

  /** Disable 2FA for the authenticated user. Requires the current 6-digit TOTP code
   *  to confirm intent. Deletes the encrypted secret and all backup codes. */
  @Post('disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable 2FA (requires current OTP code)' })
  async disable(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: Disable2faDto,
  ) {
    const isValid = await this.svc.verifyLogin(user.userId, dto.code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid code');
    }
    await this.svc.disable(user.userId);

    return { success: true, message: 'Two-factor authentication disabled' };
  }
}
