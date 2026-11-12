import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * For public routes that show more to some people: a valid access token sets request.user,
 * while a missing, expired or invalid one leaves the request anonymous instead of refusing it.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // Anonymous: the route decides what an anonymous visitor may see.
    }
    return true;
  }

  handleRequest<TUser>(_err: unknown, user: TUser): TUser {
    return user;
  }
}
