/**
 * @file billing.controller.ts
 * @description Gateway-agnostic webhook receiver for the Subscription Manager.
 */
import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { GenericBillingWebhookDto } from './dto/generic-billing-webhook.dto';

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /**
   * POST /billing/webhook
   *
   * Public (no JWT) — verified via HMAC-SHA256 signature against
   * BILLING_WEBHOOK_SECRET, computed over the raw request body (see
   * `rawBody: true` in main.ts) rather than the parsed DTO. PayPal/Stripe
   * deliver to their own existing endpoints instead (see billing.service.ts
   * header comment).
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generic subscription billing webhook receiver',
    description:
      'Reserved for payment gateways integrated directly against the Subscription domain. Do not call manually.',
  })
  @ApiHeader({ name: 'x-billing-signature', description: 'HMAC-SHA256 signature', required: true })
  @ApiResponse({ status: 200, description: 'Webhook processed (idempotent)' })
  @ApiResponse({ status: 422, description: 'Signature verification failed' })
  handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Body() dto: GenericBillingWebhookDto,
    @Headers('x-billing-signature') signature: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    return this.billingService.handleGenericWebhook(dto, rawBody, signature);
  }
}
