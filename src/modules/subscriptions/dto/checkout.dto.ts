/**
 * @file checkout.dto.ts
 * @description DTO for starting a subscription checkout.
 */
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const CHECKOUT_METHODS = ['CHAPA', 'PAYPAL'] as const;
export type CheckoutMethod = (typeof CHECKOUT_METHODS)[number];

export class CheckoutDto {
  @ApiProperty({ description: 'UUID of the Plan to subscribe to' })
  @IsUUID()
  planId: string;

  @ApiPropertyOptional({
    enum: CHECKOUT_METHODS,
    default: 'CHAPA',
    description: 'CHAPA pays one period at a time; PAYPAL renews automatically every period',
  })
  @IsOptional()
  @IsIn(CHECKOUT_METHODS)
  method?: CheckoutMethod;
}
