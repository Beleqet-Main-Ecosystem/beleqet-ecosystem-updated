/**
 * @file webhook.dto.ts
 * @description DTOs for incoming Stripe and PayPal webhook events.
 *
 * NOTE: Webhook bodies are raw Buffer (for Stripe signature verification)
 * or plain JSON (PayPal).  These DTOs describe the *query/header* context
 * passed alongside the raw body rather than transforming the body itself.
 */
import { IsOptional, IsString, IsUUID, IsInt, Min, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Headers/query parameters context for incoming Stripe webhook.
 * The raw body is handled separately (via RawBody buffer in controller).
 */
export class StripeWebhookDto {
  /**
   * Stripe-Signature header value — required for HMAC verification.
   * Validated in StripeService.handleWebhook.
   */
  @ApiProperty({
    description: 'Value of the Stripe-Signature header sent by Stripe',
    example: 't=1729012345,v1=abc123...',
  })
  @IsString()
  stripeSignature: string;
}

/**
 * Headers/query parameters context for incoming PayPal webhook.
 * PayPal sends multiple verification headers.
 */
export class PaypalWebhookDto {
  @ApiProperty({ description: 'PayPal-Transmission-Id header' })
  @IsString()
  transmissionId: string;

  @ApiProperty({ description: 'PayPal-Transmission-Time header' })
  @IsString()
  transmissionTime: string;

  @ApiProperty({ description: 'PayPal-Cert-Url header — certificate URL' })
  @IsString()
  certUrl: string;

  @ApiProperty({ description: 'PayPal-Auth-Algo header — algorithm used for signature' })
  @IsString()
  authAlgo: string;

  @ApiProperty({ description: 'PayPal-Transmission-Sig header — signature value' })
  @IsString()
  transmissionSig: string;
}

/**
 * DTO for issuing a refund against an existing Stripe charge.
 */
export class CreateRefundDto {
  /**
   * The Stripe Payment Intent ID (pi_…) to refund.
   */
  @ApiProperty({
    description: 'Stripe Payment Intent ID to refund',
    example: 'pi_3Pq1234567890',
  })
  @IsString()
  @Length(1, 255)
  paymentIntentId: string;

  /**
   * Optional partial refund amount (in smallest currency unit).
   * If omitted, the full charge is refunded.
   */
  @ApiPropertyOptional({
    description: 'Partial refund amount in smallest currency unit. Omit for full refund.',
    example: 500,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  /**
   * Reason for refund — stored in Stripe dashboard.
   */
  @ApiPropertyOptional({
    description: 'Reason for refund (shown in Stripe dashboard)',
    example: 'Job posting removed by admin',
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  reason?: string;
}

/**
 * DTO for capturing a PayPal order that was previously AUTHORIZED.
 */
export class CapturePaypalOrderDto {
  /**
   * PayPal order ID returned from the createOrder call.
   */
  @ApiProperty({
    description: 'PayPal Order ID to capture',
    example: '5O190127TN364715T',
  })
  @IsString()
  @Length(1, 64)
  orderId: string;
}
