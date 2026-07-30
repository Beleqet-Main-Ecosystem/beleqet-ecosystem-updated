import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { AssignPermissionDto } from './dto/assign-permission.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

/**
 * Controller for managing Roles and Permissions
 */
@Controller('admin/rbac')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@RequirePermissions('manage:roles')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Post('roles')
  async createRole(@Body() createRoleDto: CreateRoleDto) {
    return this.rbacService.createRole(createRoleDto);
  }

  @Get('roles')
  async getRoles() {
    return this.rbacService.getRoles();
  }

  @Post('permissions')
  async createPermission(@Body() createPermissionDto: CreatePermissionDto) {
    return this.rbacService.createPermission(createPermissionDto);
  }

  @Get('permissions')
  async getPermissions() {
    return this.rbacService.getPermissions();
  }

  @Post('roles/:roleId/permissions')
  async assignPermissionToRole(
    @Param('roleId') roleId: string,
    @Body() assignPermissionDto: AssignPermissionDto,
  ) {
    return this.rbacService.assignPermissionToRole(roleId, assignPermissionDto.permissionId);
  }

  @Post('users/:userId/roles')
  async assignRoleToUser(@Param('userId') userId: string, @Body() assignRoleDto: AssignRoleDto) {
    return this.rbacService.assignRoleToUser(userId, assignRoleDto.roleId);
  }
}
