import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreatePermissionDto {
  /**
   * The unique action string representing the permission (e.g., 'create:jobs')
   */
  @IsString()
  @IsNotEmpty()
  action: string;

  /**
   * Optional description of the permission
   */
  @IsString()
  @IsOptional()
  description?: string;
}
