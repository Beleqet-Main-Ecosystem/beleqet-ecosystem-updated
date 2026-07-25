import {
  IsEmail,
  IsEnum,
  IsISO4217CurrencyCode,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { EmailType } from '@prisma/client';

/**
 * Payload for triggering a single automated email dispatch.
 * Used by internal services (auth, billing) and by the admin
 * "resend" action in the dashboard.
 */
export class SendEmailDto {
  @IsEmail()
  recipient: string;

  @IsEnum(EmailType)
  type: EmailType;

  @IsOptional()
  @IsUUID()
  userId?: string;

  /** BCP-47 locale code, e.g. "en", "am". Defaults to "en" in the service. */
  @IsOptional()
  @IsString()
  locale?: string;

  /** Variables injected into the Handlebars template (name, amount, link, etc.) */
  @IsObject()
  @IsOptional()
  variables?: Record<string, unknown>;

  /**
   * Required for PAYMENT_RECEIPT so the amount can be formatted correctly
   * per-currency (decimal places, symbol placement) rather than displayed
   * as a raw number. ISO 4217 code, e.g. "USD", "ETB", "EUR".
   */
  @ValidateIf((dto: SendEmailDto) => dto.type === EmailType.PAYMENT_RECEIPT)
  @IsISO4217CurrencyCode()
  currency?: string;
}
