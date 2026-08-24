// =============================================================================
// common/guards/jwt-auth.guard.ts
// =============================================================================
import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { firstValueFrom, Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV === 'test') {
      const request = context.switchToHttp().getRequest<{
        user?: { userId: string };
        headers?: Record<string, string | undefined>;
      }>();

      // Only bypass JWT validation when the test explicitly supplies an identity.
      // If no x-test-user-id header is present, fall through to the real guard
      // so that unauthenticated-request tests still receive 401.
      const testUserId = request.headers?.['x-test-user-id'];
      if (testUserId) {
        if (!request.user) {
          request.user = { userId: testUserId };
        }
        return true;
      }
    }

    const result = super.canActivate(context);

    if (result instanceof Observable) {
      return firstValueFrom(result);
    }

    return result as boolean | Promise<boolean>;
  }
}
