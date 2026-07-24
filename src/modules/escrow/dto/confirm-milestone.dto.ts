import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConfirmMilestoneDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
