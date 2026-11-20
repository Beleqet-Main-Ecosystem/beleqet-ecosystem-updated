import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class SubmitManualPaymentDto {
  /** The payment record id to attach the receipt to */
  @IsUUID('4', { message: 'paymentId must be a valid UUID v4' })
  paymentId: string;

  /** Customer-supplied bank transfer or mobile-money reference */
  @IsString()
  @Length(1, 255, { message: 'transactionReference must be 1–255 characters' })
  transactionReference: string;
}

/** Paying by bank transfer: either for a plan (the price comes from the plan) or a set amount. */
export class CreateManualPaymentDto {
  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;
}
