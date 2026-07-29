import { Injectable, ConflictException, NotFoundException, Inject } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { AUDIT_LOGGER, IAuditLogger } from '../auth/interfaces/audit-logger.interface';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

/**
 * Service handling Role-Based Access Control operations.
 */
@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: IAuditLogger,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Creates a new role.
   * @param createRoleDto Data to create a role
   * @returns The created role
   */
  async createRole(createRoleDto: CreateRoleDto) {
    const existing = await this.prisma.role.findUnique({
      where: { name: createRoleDto.name },
    });
    if (existing) {
      const message = this.i18n.t('rbac.roleExists', {
        args: { name: createRoleDto.name },
      });
      throw new ConflictException(message);
    }

    return this.prisma.role.create({
      data: createRoleDto,
    });
  }

  /**
   * Retrieves all roles with their associated permissions.
   * @returns Array of roles
   */
  async getRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: true,
      },
    });
  }

  /**
   * Creates a new permission.
   * @param createPermissionDto Data to create a permission
   * @returns The created permission
   */
  async createPermission(createPermissionDto: CreatePermissionDto) {
    const existing = await this.prisma.permission.findUnique({
      where: { action: createPermissionDto.action },
    });
    if (existing) {
      const message = this.i18n.t('rbac.permissionExists', {
        args: { action: createPermissionDto.action },
      });
      throw new ConflictException(message);
    }

    return this.prisma.permission.create({
      data: createPermissionDto,
    });
  }

  /**
   * Retrieves all available permissions.
   * @returns Array of permissions
   */
  async getPermissions() {
    return this.prisma.permission.findMany();
  }

  /**
   * Assigns a permission to a role.
   * @param roleId The ID of the role
   * @param permissionId The ID of the permission
   * @returns The updated role
   */
  async assignPermissionToRole(roleId: string, permissionId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(this.i18n.t('rbac.roleNotFound'));
    }

    const permission = await this.prisma.permission.findUnique({ where: { id: permissionId } });
    if (!permission) {
      throw new NotFoundException(this.i18n.t('rbac.permissionNotFound'));
    }

    const updatedRole = await this.prisma.role.update({
      where: { id: roleId },
      data: {
        permissions: {
          connect: { id: permissionId },
        },
      },
      include: { permissions: true },
    });

    // Invalidate the cache for all users globally as a safeguard,
    // since we don't know exactly which users are currently caching this role.
    await this.redis.eval(
      `
      local keys = redis.call("keys", ARGV[1])
      for i=1,#keys,5000 do
        redis.call("del", unpack(keys, i, math.min(i+4999, #keys)))
      end
      return keys
      `,
      0,
      'user_permissions:*',
    );

    return updatedRole;
  }

  /**
   * Assigns a role to a user.
   * respects GDPR/privacy by ensuring only authorized changes are made.
   * @param userId The ID of the user
   * @param roleId The ID of the role
   * @returns The updated user
   */
  async assignRoleToUser(userId: string, roleId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(this.i18n.t('rbac.userNotFound'));
    }

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException(this.i18n.t('rbac.roleNotFound'));
    }

    // Wrap the role assignment and GDPR audit log inside a transaction
    const updatedUser = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      return await tx.user.update({
        where: { id: userId },
        data: {
          rbacRoles: {
            connect: { id: roleId },
          },
        },
        include: { rbacRoles: true },
      });
    });

    // GDPR/Security Audit Log: record that authorization changed
    await this.auditLogger.log('USER_ROLE_ASSIGNED', userId, {
      roleId,
      assignedAt: new Date().toISOString(),
    });

    // Invalidate user's permission cache
    await this.redis.del(`user_permissions:${userId}`);

    return updatedUser;
  }
}
