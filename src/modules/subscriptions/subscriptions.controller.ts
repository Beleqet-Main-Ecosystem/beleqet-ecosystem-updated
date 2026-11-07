/**
 * @file subscriptions.controller.ts
 * @description
 * REST controller for the user-facing Subscription lifecycle.
 *
 * Route group: /subscriptions
 *  - POST /subscriptions/checkout   — create a pending subscription + gateway payment intent
 *  - GET  /subscriptions/me         — the caller's current subscription
 *  - POST /subscriptions/:id/cancel — cancel at period end
 *  - GET  /subscriptions (ADMIN)    — list all subscriptions, filterable by status
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SubscriptionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../../common/guards/verified-email.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsCheckoutService } from './subscriptions-checkout.service';
import { CheckoutDto } from './dto/checkout.dto';
import { PlanPaymentsService } from './plan-payments.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly checkoutService: SubscriptionsCheckoutService,
    private readonly planPayments: PlanPaymentsService,
  ) {}

  @Post('checkout')
  @UseGuards(VerifiedEmailGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Start a subscription checkout',
    description:
      'Opens a Chapa checkout (Telebirr, CBE Birr, banks, cards) for one period of the plan. Redirect the user to checkoutUrl; the plan starts when the payment is confirmed. Paying for the running plan adds a period; another plan replaces it.',
  })
  @ApiResponse({ status: 201, description: 'Checkout started. Redirect user to checkoutUrl.' })
  @ApiResponse({ status: 404, description: 'Plan not found or inactive' })
  checkout(@CurrentUser() user: CurrentUserPayload, @Body() dto: CheckoutDto) {
    return this.checkoutService.checkout(user.userId, dto);
  }

  /** Whether a plan payment went through, for the page Chapa sends people back to. */
  @Get('payments/:id')
  paymentStatus(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.planPayments.status(user.userId, id);
  }

  @Get('me')
  @ApiOperation({ summary: "Get the caller's current subscription" })
  @ApiResponse({ status: 200, description: 'Current subscription (or null if none)' })
  async findMine(@CurrentUser() user: CurrentUserPayload) {
    // A Chapa payment the callback missed is confirmed here, before the plan is read.
    await this.planPayments.confirmRecent(user.userId).catch(() => undefined);
    return this.subscriptionsService.findMine(user.userId);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a subscription',
    description: 'Access continues until the end of the current billing period.',
  })
  @ApiResponse({ status: 200, description: 'Subscription set to cancel at period end' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  cancel(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.checkoutService.cancel(id, user.userId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @RequirePermissions('manage:billing')
  @ApiOperation({ summary: 'List all subscriptions (Admin only)' })
  @ApiQuery({ name: 'status', required: false, enum: SubscriptionStatus })
  @ApiResponse({ status: 200, description: 'List of subscriptions' })
  findAll(@Query('status') status?: SubscriptionStatus) {
    return this.subscriptionsService.findAllForAdmin(status);
  }
}
