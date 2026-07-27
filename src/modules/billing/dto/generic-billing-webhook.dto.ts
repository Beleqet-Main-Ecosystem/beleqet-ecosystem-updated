/**
 * @file generic-billing-webhook.dto.ts
 * @description
 * DTO for POST /billing/webhook — the gateway-agnostic webhook entrypoint.
 * PayPal and Stripe continue to deliver to their existing, already-deployed
 * endpoints (/payments/paypal/webhook, /payments/stripe/webhook) which sync
 * into the Subscription domain via an in-process event instead (see
 * paypal.service.ts). This endpoint is reserved for gateways integrated
 * directly against the Subscription domain going forward.
 */
import {
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUppercase,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentProvider } from '@prisma/client';
import { SubscriptionLifecycleEvent } from '../../subscriptions/subscriptions.service';

const LIFECYCLE_EVENTS: SubscriptionLifecycleEvent[] = [
  'ACTIVATED',
  'RENEWED',
  'PAYMENT_FAILED',
  'CANCELLED',
  'EXPIRED',
];

export class GenericBillingWebhookDto {
  @ApiProperty({ description: "Gateway's own event id (idempotency key)" })
  @IsString()
  gatewayEventId: string;

  @ApiProperty({ enum: PaymentProvider })
  @IsEnum(PaymentProvider)
  provider: PaymentProvider;

  @ApiProperty({ enum: LIFECYCLE_EVENTS })
  @IsIn(LIFECYCLE_EVENTS)
  eventType: SubscriptionLifecycleEvent;

  @ApiProperty({ description: 'Gateway-side recurring-billing id' })
  @IsString()
  providerSubscriptionId: string;

  @ApiPropertyOptional({ description: 'Charge amount in minor units' })
  @IsOptional()
  @IsInt()
  amount?: number;

  @ApiPropertyOptional({ description: 'ISO 4217 currency code' })
  @IsOptional()
  @IsString()
  @IsUppercase()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Provider-side reference for this specific charge' })
  @IsOptional()
  @IsString()
  gatewayReference?: string;

  @ApiPropertyOptional({
    description: 'Raw event payload for the audit trail (PII must already be stripped)',
  })
  @IsOptional()
  @IsObject()
  rawPayload?: Record<string, unknown>;
}
