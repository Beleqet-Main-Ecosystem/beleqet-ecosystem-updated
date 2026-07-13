import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { PersonalInfoDto } from './extracted-resume.dto';

/**
 * Selects which parsed resume's data should be applied to the professional's
 * profile. `personalInfo`/`skills` are optional overrides — when provided
 * (e.g. after the user corrects the extracted data in the review form),
 * they are applied instead of the originally stored parsed values.
 */
export class AutofillProfileDto {
  @ApiProperty({ example: 'b3f1c2b0-8f1a-4b8b-9c1a-7e2a6f1e2d33' })
  @IsUUID()
  resumeId: string;

  @ApiProperty({ required: false, type: () => PersonalInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalInfoDto)
  personalInfo?: PersonalInfoDto;

  @ApiProperty({ required: false, type: () => [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];
}
