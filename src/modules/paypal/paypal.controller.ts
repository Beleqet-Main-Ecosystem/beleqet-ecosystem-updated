import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PaypalOrderService } from './paypal-order.service';
import { PaypalSubscriptionService } from './paypal-subscription.service';
import { PaypalWebhookService } from './paypal-webhook.service';
import { PaypalDisputeService } from './paypal-dispute.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { RefundDto } from './dto/refund.dto';

/**
 * PayPal Global Digital Wallet controller.
 *
 * All payment-facing endpoints require JWT authentication.
 * The webhook endpoint (`POST /paypal/webhooks`) is intentionally
 * unauthenticated but protected by PayPal's asymmetric signature
 * verification performed inside `PaypalWebhookService.verifyAndDispatch`.
 *
 * @tag paypal
 */
@ApiTags('paypal')
@Controller('paypal')
export class PaypalController {
  constructor(
    private readonly orderSvc:        PaypalOrderService,
    private readonly subscriptionSvc: PaypalSubscriptionService,
    private readonly webhookSvc:      PaypalWebhookService,
    private readonly disputeSvc:      PaypalDisputeService,
  ) {}

  // ── Orders ─────────────────────────────────────────────────────────────────

  /**
   * Creates a PayPal Order and returns the buyer approval URL.
   * The client should redirect the user to `approveUrl` to complete payment.
   */
  @Post('create-order')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a PayPal one-time payment order',
    description:
      'Initiates a PayPal Order for the specified amount and currency. ' +
      'Returns an `approveUrl` to redirect the buyer to PayPal for approval.',
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({
    status: 201,
    description: 'Order created — redirect the user to `approveUrl`',
    schema: {
      example: {
        transactionId: 'uuid-v4',
        orderId:       '5O190127TN364715T',
        approveUrl:    'https://www.sandbox.paypal.com/checkoutnow?token=...',
        amount:        150.0,
        currency:      'USD',
        platformFee:   7.5,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request or PayPal rejection' })
  @ApiResponse({ status: 409, description: 'Duplicate idempotency key' })
  createOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateOrderDto,
  ) {
    return this.orderSvc.createOrder(user.userId, dto);
  }

  /**
   * Captures an approved PayPal order, finalising the charge.
   * Call this after the user returns from the PayPal approval URL.
   */
  @Post('capture-order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Capture an approved PayPal order',
    description:
      'Finalises the charge on an order that has been approved by the buyer. ' +
      'Safe to retry — returns cached result if already captured.',
  })
  @ApiParam({ name: 'orderId', description: 'PayPal Order ID', example: '5O190127TN364715T' })
  @ApiResponse({
    status: 201,
    description: 'Order captured successfully',
    schema: {
      example: {
        transactionId: 'uuid-v4',
        orderId:       '5O190127TN364715T',
        captureId:     '3C679366HH908993F',
        status:        'CAPTURED',
        amount:        '150.00',
        currency:      'USD',
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Order not found for this user' })
  captureOrder(
    @CurrentUser() user: CurrentUserPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.orderSvc.captureOrder(user.userId, orderId);
  }

  // ── Subscriptions ──────────────────────────────────────────────────────────

  /**
   * Creates a PayPal subscription and returns the buyer approval URL.
   */
  @Post('create-subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a PayPal recurring subscription',
    description:
      'Initiates a billing agreement for the given plan ID. ' +
      'The user must be redirected to `approveUrl` to activate the subscription.',
  })
  @ApiBody({ type: CreateSubscriptionDto })
  @ApiResponse({
    status: 201,
    description: 'Subscription initiated — redirect user to `approveUrl`',
    schema: {
      example: {
        localId:        'uuid-v4',
        subscriptionId: 'I-BW452GLLEP1G',
        approveUrl:     'https://www.sandbox.paypal.com/webapps/billing/subscriptions/...',
        planId:         'P-5ML4271244454362WXNWU5NQ',
      },
    },
  })
  createSubscription(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptionSvc.createSubscription(user.userId, dto);
  }

  /**
   * Suspends an active subscription (billing paused, reversible).
   */
  @Post('subscriptions/:subscriptionId/suspend')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Suspend a PayPal subscription' })
  @ApiParam({ name: 'subscriptionId', description: 'PayPal Subscription ID', example: 'I-BW452GLLEP1G' })
  @ApiResponse({ status: 201, description: 'Subscription suspended' })
  @ApiResponse({ status: 404, description: 'Subscription not found for this user' })
  suspendSubscription(
    @CurrentUser() user: CurrentUserPayload,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.subscriptionSvc.suspendSubscription(user.userId, subscriptionId);
  }

  /**
   * Permanently cancels a subscription.
   */
  @Post('subscriptions/:subscriptionId/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a PayPal subscription (permanent)' })
  @ApiParam({ name: 'subscriptionId', description: 'PayPal Subscription ID', example: 'I-BW452GLLEP1G' })
  @ApiResponse({ status: 201, description: 'Subscription cancelled' })
  @ApiResponse({ status: 404, description: 'Subscription not found for this user' })
  cancelSubscription(
    @CurrentUser() user: CurrentUserPayload,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    return this.subscriptionSvc.cancelSubscription(user.userId, subscriptionId);
  }

  // ── Refunds ────────────────────────────────────────────────────────────────

  /**
   * Issues a partial or full refund on a captured payment.
   */
  @Post('refund/:captureId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Refund a captured PayPal payment',
    description:
      'Issues a full refund when `amount` is omitted, or a partial refund ' +
      'when an `amount` value is provided. Only the original payer (client) ' +
      'can initiate a refund.',
  })
  @ApiParam({ name: 'captureId', description: 'PayPal Capture ID', example: '3C679366HH908993F' })
  @ApiBody({ type: RefundDto })
  @ApiResponse({ status: 201, description: 'Refund issued successfully' })
  @ApiResponse({ status: 404, description: 'Capture ID not found for this user' })
  refund(
    @CurrentUser() user: CurrentUserPayload,
    @Param('captureId') captureId: string,
    @Body() dto: RefundDto,
  ) {
    return this.disputeSvc.refund(captureId, user.userId, dto);
  }

  // ── Webhooks ───────────────────────────────────────────────────────────────

  /**
   * PayPal webhook receiver.
   *
   * **Security**: This endpoint verifies the PayPal transmission signature
   * before any processing. In production, unsigned requests are rejected
   * with 401 Unauthorized. Verified events are dispatched to BullMQ for
   * async processing so this endpoint always responds in < 200ms.
   *
   * Register this URL in the PayPal Developer Dashboard → Webhooks.
   */
  @Post('webhooks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'PayPal webhook receiver (public — verified via signature)',
    description:
      'Receives PayPal webhook events. The signature is verified against ' +
      'PayPal's public certs before any processing. Do not call this endpoint directly.',
  })
  @ApiResponse({ status: 200, description: 'Event accepted and queued' })
  @ApiResponse({ status: 401, description: 'Invalid or missing PayPal signature' })
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Body() body: Record<string, unknown>,
  ) {
    await this.webhookSvc.verifyAndDispatch(req, body);
    return { received: true };
  }

  // ── Health / Debug ─────────────────────────────────────────────────────────

  /**
   * Simple health check to confirm the PayPal module is registered.
   * Returns the configured PayPal mode (sandbox / live).
   */
  @Get('health')
  @ApiOperation({ summary: 'PayPal module health check' })
  @ApiResponse({ status: 200, description: 'Module is live' })
  health() {
    return { module: 'paypal', status: 'ok' };
  }
}
