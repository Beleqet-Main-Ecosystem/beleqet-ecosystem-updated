import { IsBoolean, IsOptional } from 'class-validator';

export class ModerateThreadDto {
  @IsOptional() @IsBoolean() isPinned?: boolean;
  @IsOptional() @IsBoolean() isLocked?: boolean;
}
