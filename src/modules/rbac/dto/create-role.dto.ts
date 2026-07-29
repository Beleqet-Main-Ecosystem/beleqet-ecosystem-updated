import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateRoleDto {
  /**
   * The unique name of the role (e.g., 'SUPER_ADMIN')
   */
  @IsString()
  @IsNotEmpty()
  name: string;

  /**
   * Optional description of the role
   */
  @IsString()
  @IsOptional()
  description?: string;

  /**
   * Flag indicating if this is a system role (cannot be deleted)
   */
  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;
}
