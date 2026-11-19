import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * GraphQL-aware version of RolesGuard.
 *
 * The standard RolesGuard (roles.guard.ts) reads the user from
 * `context.switchToHttp().getRequest()`, which returns undefined inside a
 * GraphQL resolver because the execution context type is 'graphql', not 'http'.
 *
 * This guard checks the context type and falls back to the GQL Apollo context
 * when needed, making it safe to use on both REST and GraphQL handlers.
 */
@Injectable()
export class GqlRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator — allow anyone through
    if (!requiredRoles || requiredRoles.length === 0) return true;

    let user: { role: string } | undefined;

    if (context.getType<string>() === 'graphql') {
      const gqlCtx = GqlExecutionContext.create(context);
      user = gqlCtx.getContext().req?.user;
    } else {
      user = context.switchToHttp().getRequest<{ user: { role: string } }>().user;
    }

    return requiredRoles.includes(user?.role ?? '');
  }
}
