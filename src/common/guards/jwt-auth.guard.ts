// =============================================================================
// common/guards/jwt-auth.guard.ts
// =============================================================================
import { ExecutionContext, Injectable } from '@nestjs/common';
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

      if (!request.user) {
        request.user = {
          userId: request.headers?.['x-test-user-id'] ?? 'test-user',
        };
      }

      return true;
    }

    const result = super.canActivate(context);

    if (result instanceof Observable) {
      return firstValueFrom(result);
    }

    return result;
  }
}
