import { IsString, IsNotEmpty } from 'class-validator';

export class AssignPermissionDto {
  /**
   * The ID of the permission to assign
   */
  @IsString()
  @IsNotEmpty()
  permissionId: string;
}
