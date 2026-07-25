import {
  IsString,
  IsArray,
  IsUrl,
  IsOptional,
  MinLength,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDisputeDto {
  @ApiProperty({ description: 'Contract ID the dispute is raised on' })
  @IsString()
  contractId: string;

  @ApiProperty({ description: 'Reason for raising the dispute', minLength: 50, maxLength: 2000 })
  @IsString()
  @MinLength(50)
  @MaxLength(2000)
  reason: string;

  @ApiProperty({
    description: 'Evidence URLs (screenshots, documents, etc.). Optional.',
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  @ArrayMaxSize(10)
  evidenceUrls?: string[];
}
