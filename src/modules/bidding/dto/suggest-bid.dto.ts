import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for bid price suggestion requests.
 */
export class SuggestBidDto {
  @ApiProperty({ example: 'f05b2516-f887-4f58-b44b-791f6c93f396' })
  @IsUUID()
  freelanceJobId: string;
}

/**
 * Response structure for bid price suggestions.
 */
export interface SuggestBidResponse {
  suggestedPrice: number;
  currency: string;
  rationale: string;
  budgetMin: number;
  budgetMax: number;
}
