import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { SENSITIVE_ACTION_KEY, ACTION_TYPE_KEY } from '../decorators/sensitive-action.decorator';

const STEP_UP_WINDOW_MINUTES = 15;
const STEP_UP_TEMP_EXPIRY = 5;

@Injectable()
export class StepUpGuard implements CanActivate {
  private readonly logger = new Logger(StepUpGuard.name);
  private readonly tempSecret: string;
  private readonly accessSecret: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.accessSecret = config.get<string>('JWT_ACCESS_SECRET')!;
    const ts = config.get<string>('TOTP_TEMP_SECRET');
    if (!ts) {
      throw new Error(
        'TOTP_TEMP_SECRET is required. Set it in your environment variables.',
      );
    }
    this.tempSecret = ts;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isSensitive = this.reflector.getAllAndOverride<boolean>(
      SENSITIVE_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!isSensitive) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization as string | undefined;
    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');

    // Accept step-up token via x-step-up-token header first, then fall back
    // to checking the Bearer token. This allows JwtAuthGuard to validate the
    // access token (signed with JWT_ACCESS_SECRET) while StepUpGuard validates
    // the step-up token (signed with TOTP_TEMP_SECRET) from a separate header.
    const stepUpHeader = request.headers?.['x-step-up-token'] as string | undefined;
    if (stepUpHeader) {
      const stepUpPayload = this.tryVerifyStepUp(stepUpHeader);
      if (stepUpPayload) {
        this.validateStepUpExpiry(request, stepUpPayload);
        this.validateActionScope(context, stepUpPayload);
        return true;
      }
    }

    const stepUpPayload = this.tryVerifyStepUp(token);
    if (stepUpPayload) {
      this.validateStepUpExpiry(request, stepUpPayload);
      this.validateActionScope(context, stepUpPayload);
      request.user = { userId: stepUpPayload.sub };
      return true;
    }

    const accessPayload = this.tryVerifyAccess(token);
    if (!accessPayload) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const userId = accessPayload.sub;
    request.user = { userId, email: accessPayload.email, role: accessPayload.role };

    // Check if the user has 2FA enabled. If not, skip step-up entirely —
    // the user hasn't opted into 2FA, so they shouldn't be blocked from
    // their own account actions. This matches the conditional pattern used
    // by requireStepUpOrThrow() in the auth service for password/email change.
    const twoFactor = await this.prisma.userTwoFactor.findUnique({
      where: { userId },
    });
    if (!twoFactor?.enabled) {
      return true;
    }

    this.logger.warn(
      `Sensitive action attempted without step-up verification by user ${userId}`,
    );

    throw new UnauthorizedException({
      requiresStepUp: true,
      message: 'This action requires recent two-factor verification. Please re-verify.',
      stepUpToken: this.generateStepUpChallenge(userId),
    });
  }

  private validateStepUpExpiry(request: any, payload: Record<string, any>): void {
    const now = Math.floor(Date.now() / 1000);
    if (now - payload['2fa_verified_at'] > STEP_UP_WINDOW_MINUTES * 60) {
      throw new UnauthorizedException({
        requiresStepUp: true,
        message: 'Step-up verification has expired. Please re-verify.',
        stepUpToken: this.generateStepUpChallenge(request.user?.userId),
      });
    }
  }

  private validateActionScope(context: ExecutionContext, payload: Record<string, any>): void {
    if (!payload.action) return;

    const routeAction = this.reflector.getAllAndOverride<string | undefined>(
      ACTION_TYPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!routeAction) return;

    if (payload.action !== routeAction) {
      throw new ForbiddenException(
        `Step-up token scoped to "${payload.action}" but this endpoint requires "${routeAction}"`,
      );
    }
  }

  private tryVerifyStepUp(token: string): Record<string, any> | null {
    try {
      const payload = this.jwt.verify(token, { secret: this.tempSecret }) as any;
      if (payload.purpose === '2fa_step_up' && payload['2fa_verified_at']) {
        return payload;
      }
      return null;
    } catch {
      return null;
    }
  }

  private tryVerifyAccess(token: string): Record<string, any> | null {
    try {
      return this.jwt.verify(token, { secret: this.accessSecret }) as any;
    } catch {
      return null;
    }
  }

  private generateStepUpChallenge(userId: string | undefined): string {
    return this.jwt.sign(
      {
        sub: userId,
        purpose: '2fa_step_up_challenge',
        action: 'sensitive_action',
        iat: Math.floor(Date.now() / 1000),
      },
      { secret: this.tempSecret, expiresIn: `${STEP_UP_TEMP_EXPIRY}m` },
    );
  }
}
