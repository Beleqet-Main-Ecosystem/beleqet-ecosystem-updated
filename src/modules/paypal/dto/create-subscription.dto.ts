import { IsString, IsIn, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a PayPal subscription (recurring billing).
 * The user will be redirected to PayPal to approve the subscription.
 */
export class CreateSubscriptionDto {
  @ApiProperty({
    example: 'P-5ML4271244454362WXNWU5NQ',
    description: 'PayPal Billing Plan ID to subscribe the user to',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  planId: string;

  @ApiPropertyOptional({
    example: 'MONTHLY',
    description: 'Human-readable plan label for display purposes',
    enum: ['MONTHLY', 'ANNUAL'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['MONTHLY', 'ANNUAL'])
  planLabel?: string;
}
