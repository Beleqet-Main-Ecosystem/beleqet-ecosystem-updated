import { IsString, IsNotEmpty } from 'class-validator';

export class AssignRoleDto {
  /**
   * The ID of the role to assign
   */
  @IsString()
  @IsNotEmpty()
  roleId: string;
}
