// common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../modules/redis/redis.module';
import Redis from 'ioredis';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (
      (!requiredRoles || requiredRoles.length === 0) &&
      (!requiredPermissions || requiredPermissions.length === 0)
    ) {
      return true;
    }

    const user = context.switchToHttp().getRequest<{ user: any }>().user;
    if (!user) return false;
    user.userId = user.userId || user.id;
    if (!user.userId || !user.role) return false;

    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(user.role)) {
        return false;
      }
    }

    if (requiredPermissions && requiredPermissions.length > 0) {
      const cacheKey = `user_permissions:${user.userId}`;
      let userPermissions: string[] = [];
      const cached = await this.redis.get(cacheKey);

      if (cached) {
        userPermissions = JSON.parse(cached);
      } else {
        const dbUser = await this.prisma.user.findUnique({
          where: { id: user.userId },
          include: { rbacRoles: { include: { permissions: true } } },
        });

        if (!dbUser) return false;

        const permSet = new Set<string>();
        dbUser.rbacRoles.forEach((role) => {
          role.permissions.forEach((permission) => {
            permSet.add(permission.action);
          });
        });

        userPermissions = Array.from(permSet);
        await this.redis.set(cacheKey, JSON.stringify(userPermissions), 'EX', 300);
      }

      const hasPermissions = requiredPermissions.every((permission) =>
        userPermissions.includes(permission),
      );
      if (!hasPermissions) return false;
    }

    return true;
  }
}
