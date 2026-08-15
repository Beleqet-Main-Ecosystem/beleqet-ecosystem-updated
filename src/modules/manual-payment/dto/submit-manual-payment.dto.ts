import { IsNumberString, IsString, IsUUID, Length } from 'class-validator';

export class SubmitManualPaymentDto {
  /** The payment record id to attach the receipt to */
  @IsUUID('4', { message: 'paymentId must be a valid UUID v4' })
  paymentId: string;

  /** Customer-supplied bank transfer or mobile-money reference */
  @IsString()
  @Length(1, 255, { message: 'transactionReference must be 1–255 characters' })
  transactionReference: string;
}
