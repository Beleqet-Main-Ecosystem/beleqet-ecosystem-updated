import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/** Approve or Reject pressed on a bank-transfer alert in the Jobs bot (the bot checks it's an admin). */
export class PaymentDecisionDto {
  @ApiProperty({ description: 'The payment id from the alert' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  order_id: string;

  @ApiProperty({
    enum: ['completed', 'cancelled'],
    description: 'completed approves, cancelled rejects',
  })
  @IsIn(['completed', 'cancelled'])
  status: 'completed' | 'cancelled';

  @ApiProperty({
    required: false,
    description: "The admin's Telegram user id, kept with the decision",
  })
  @IsOptional()
  @Matches(/^\d{1,20}$/)
  admin_telegram_id?: string;
}
