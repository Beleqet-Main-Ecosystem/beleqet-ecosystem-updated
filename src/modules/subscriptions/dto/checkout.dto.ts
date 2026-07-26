/**
 * @file checkout.dto.ts
 * @description DTO for starting a subscription checkout.
 */
import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckoutDto {
  @ApiProperty({ description: 'UUID of the Plan to subscribe to' })
  @IsUUID()
  planId: string;
}
