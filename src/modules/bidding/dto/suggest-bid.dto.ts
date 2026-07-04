import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for bid price suggestion requests.
 */
export class SuggestBidDto {
  @ApiProperty({ 
    example: 'f05b2516-f887-4f58-b44b-791f6c93f396',
    description: 'UUID of the freelance job to get a price suggestion for'
  })
  @IsUUID()
  freelanceJobId: string;
}
