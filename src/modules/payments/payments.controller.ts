/**
 * @file payments.controller.ts
 * @description
 * REST controller for the Global Payment Gateway module.
 *
 * Route groups:
 *  /payments/stripe/*   — Stripe (Task Global-Payments-001)
 *  /payments/paypal/*   — PayPal (Task Global-Payments-002)
 *
 * Security:
 *  - All routes require a valid JWT (JwtAuthGuard).
 *  - Refund and admin-report routes additionally require ADMIN role (RolesGuard).
 *  - Throttler limits: 10 payment-intent creations per minute per IP.
 *  - Webhook routes are public (no JWT) but verified via HMAC signature.
 *
 * Swagger:
 *  - Each endpoint has full @ApiOperation, @ApiResponse, and @ApiBearerAuth docs.
 */
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

import { StripeService }  from './stripe.service';
import { PaypalService }  from './paypal.service';

import { CreatePaymentIntentDto }  from './dto/create-payment-intent.dto';
import { CreatePaypalOrderDto }    from './dto/create-paypal-order.dto';
import { CreateRefundDto, CapturePaypalOrderDto } from './dto/webhook.dto';

import { JwtAuthGuard }  from '../../common/guards/jwt-auth.guard';
import { RolesGuard }    from '../../common/guards/roles.guard';
import { Roles }         from '../../common/decorators/roles.decorator';

// ─────────────────────────────────────────────────────────────────────────────
// Stripe routes
// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Payments — Stripe')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments/stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  // ── POST /payments/stripe/payment-intent ──────────────────────────────────
  @Post('payment-intent')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Create a Stripe Payment Intent',
    description: `
Creates a Stripe PaymentIntent for a Beleqet user.
Returns a \`clientSecret\` which must be passed to \`Stripe.js\` on the frontend
to complete the payment flow.

Supports **135+ currencies** (ISO 4217). Metadata is GDPR-sanitised
(raw PII keys are stripped before forwarding to Stripe).
    `,
  })
  @ApiBody({ type: CreatePaymentIntentDto })
  @ApiResponse({
    status: 201,
    description: 'PaymentIntent created successfully. Use clientSecret in Stripe.js.',
    schema: {
      example: {
        id:           'pi_3Pq1234567890',
        clientSecret: 'pi_3Pq1234_secret_XXXXXXXX',
        status:       'requires_payment_method',
        amount:       1500,
        currency:     'USD',
        createdAt:    '2026-07-06T11:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request (bad currency, missing fields)' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded — max 10 per minute' })
  @ApiResponse({ status: 500, description: 'Stripe API error' })
  createPaymentIntent(@Body() dto: CreatePaymentIntentDto) {
    return this.stripeService.createPaymentIntent(dto);
  }

  // ── POST /payments/stripe/confirm/:paymentIntentId ────────────────────────
  @Post('confirm/:paymentIntentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm a Stripe Payment Intent server-side',
    description: 'Confirms an existing PaymentIntent using a pre-attached payment method.',
  })
  @ApiParam({ name: 'paymentIntentId', description: 'Stripe Payment Intent ID (pi_…)' })
  @ApiQuery({ name: 'paymentMethodId', description: 'Stripe Payment Method ID (pm_…)', required: true })
  @ApiResponse({ status: 200, description: 'PaymentIntent confirmed' })
  @ApiResponse({ status: 422, description: 'Card declined or invalid payment method' })
  confirmPayment(
    @Param('paymentIntentId') paymentIntentId: string,
    @Query('paymentMethodId') paymentMethodId: string,
  ) {
    return this.stripeService.confirmPayment(paymentIntentId, paymentMethodId);
  }

  // ── POST /payments/stripe/refund ──────────────────────────────────────────
  @Post('refund')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Issue a Stripe refund (Admin only)',
    description: 'Issues a full or partial refund against an existing Stripe charge. Requires ADMIN role.',
  })
  @ApiBody({ type: CreateRefundDto })
  @ApiResponse({ status: 200, description: 'Refund issued successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — ADMIN role required' })
  refund(@Body() dto: CreateRefundDto) {
    return this.stripeService.refund(dto);
  }

  // ── GET /payments/stripe/currencies ───────────────────────────────────────
  @Get('currencies')
  @ApiOperation({
    summary: 'List Stripe-supported currencies',
    description: 'Returns a curated list of ISO 4217 currency codes supported by Stripe, with minimum amounts.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of supported currencies',
    schema: {
      example: [
        { code: 'USD', minimumAmount: 50,   zeroDecimal: false },
        { code: 'ETB', minimumAmount: 100,  zeroDecimal: false },
        { code: 'JPY', minimumAmount: 50,   zeroDecimal: true  },
      ],
    },
  })
  listSupportedCurrencies() {
    return this.stripeService.listSupportedCurrencies();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stripe Webhook — public (no JWT), verified via HMAC
// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Payments — Stripe')
@Controller('payments/stripe/webhook')
export class StripeWebhookController {
  constructor(private readonly stripeService: StripeService) {}

  /**
   * POST /payments/stripe/webhook
   *
   * Stripe sends a raw body (not JSON-parsed). Express `rawBody` middleware
   * must be enabled in main.ts for signature verification to work.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stripe webhook receiver',
    description: `
Receives Stripe webhook events. **Do not call manually.**
The body must be the raw Buffer (not JSON-parsed) for HMAC signature verification.

Configure your Stripe webhook endpoint to point to this URL.
Supported events:
- payment_intent.succeeded
- payment_intent.payment_failed
- payment_intent.processing
- charge.refunded
    `,
  })
  @ApiHeader({ name: 'stripe-signature', description: 'Stripe HMAC signature header', required: true })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 422, description: 'Signature verification failed' })
  handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
    return this.stripeService.handleWebhook(rawBody, signature);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PayPal routes
// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Payments — PayPal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments/paypal')
export class PaypalController {
  constructor(private readonly paypalService: PaypalService) {}

  // ── POST /payments/paypal/order ───────────────────────────────────────────
  @Post('order')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Create a PayPal Checkout order',
    description: `
Creates a PayPal order and returns an \`approvalUrl\`.
Redirect the user to \`approvalUrl\` for payer approval.

Optionally include \`subscriptionPlanId\` to create a **recurring subscription** instead.
    `,
  })
  @ApiBody({ type: CreatePaypalOrderDto })
  @ApiResponse({
    status: 201,
    description: 'PayPal order created. Redirect user to approvalUrl.',
    schema: {
      example: {
        id:          '5O190127TN364715T',
        status:      'created',
        approvalUrl: 'https://www.sandbox.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token=…',
        amount:      '25.00',
        currency:    'USD',
        createdAt:   '2026-07-06T11:00:00.000Z',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  createOrder(@Body() dto: CreatePaypalOrderDto) {
    return this.paypalService.createOrder(dto);
  }

  // ── POST /payments/paypal/capture ─────────────────────────────────────────
  @Post('capture')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Capture an approved PayPal order',
    description: 'Executes (captures) a PayPal order after payer approval. Pass the orderId and PayerID from the PayPal redirect.',
  })
  @ApiBody({ type: CapturePaypalOrderDto })
  @ApiQuery({ name: 'PayerID', description: 'PayPal PayerID from approval redirect', required: true })
  @ApiResponse({ status: 200, description: 'Order captured successfully' })
  @ApiResponse({ status: 400, description: 'PayerID missing or invalid' })
  captureOrder(
    @Body() dto: CapturePaypalOrderDto,
    @Query('PayerID') payerId: string,
  ) {
    return this.paypalService.captureOrder(dto, payerId);
  }

  // ── POST /payments/paypal/subscription ───────────────────────────────────
  @Post('subscription')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Create a PayPal recurring subscription',
    description: 'Creates a PayPal Billing Agreement (subscription) for recurring payments. Returns approvalUrl to activate.',
  })
  @ApiBody({ type: CreatePaypalOrderDto })
  @ApiResponse({ status: 201, description: 'Subscription created. Redirect user to approvalUrl.' })
  @ApiResponse({ status: 400, description: 'subscriptionPlanId is required' })
  createSubscription(@Body() dto: CreatePaypalOrderDto) {
    return this.paypalService.createSubscription(dto);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PayPal Webhook — public (no JWT), verified via PayPal signature headers
// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Payments — PayPal')
@Controller('payments/paypal/webhook')
export class PaypalWebhookController {
  constructor(private readonly paypalService: PaypalService) {}

  /**
   * POST /payments/paypal/webhook
   *
   * PayPal sends JSON events with verification headers.
   * Configure your PayPal webhook to point to this URL.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'PayPal webhook receiver',
    description: `
Receives PayPal webhook events. **Do not call manually.**

Supported events:
- PAYMENT.CAPTURE.COMPLETED
- PAYMENT.CAPTURE.DENIED
- PAYMENT.SALE.COMPLETED
- PAYMENT.SALE.REFUNDED
- BILLING.SUBSCRIPTION.ACTIVATED
- BILLING.SUBSCRIPTION.CANCELLED
    `,
  })
  @ApiHeader({ name: 'paypal-transmission-id', description: 'PayPal transmission ID', required: true })
  @ApiHeader({ name: 'paypal-transmission-sig', description: 'PayPal signature', required: true })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 422, description: 'Signature verification failed' })
  handleWebhook(@Body() body: unknown, @Req() req: Request) {
    const headers: Record<string, string> = {};
    for (const key of Object.keys(req.headers)) {
      headers[key] = String(req.headers[key] ?? '');
    }
    return this.paypalService.handleWebhook(
      body as Parameters<PaypalService['handleWebhook']>[0],
      headers,
    );
  }
}
