import { IsNotEmpty, IsNumber, IsString, IsPositive, Length } from 'class-validator';

/**
 * Data Transfer Object for validating Payment Intent creation requests.
 */
export class CreatePaymentIntentDto {
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  currency: string; // e.g., 'usd', 'eur'

  @IsNotEmpty()
  @IsString()
  bookingId: string;
}