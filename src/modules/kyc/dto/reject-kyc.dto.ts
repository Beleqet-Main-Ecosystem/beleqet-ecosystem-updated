import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

/**
 * Validates operational data parameters for manual administrative rejections.
 */
export class RejectKycDto {
  @ApiProperty({
    example: 'The uploaded document image resolution is too blurry to parse details.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Rejection reason must be at least 5 characters long' })
  reason: string = '';
}
