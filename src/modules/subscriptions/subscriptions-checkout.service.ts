/**
 * @file subscriptions-checkout.service.ts
 * @description
 * Orchestrates the checkout/cancel flows that need the PayPal gateway.
 * Split out from SubscriptionsService so that service stays gateway-agnostic
 * (see its file header) — this class is the one place in the Subscriptions
 * module allowed to depend on PaymentsModule.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaypalService } from '../payments/paypal.service';
import { SubscriptionsService } from './subscriptions.service';
import { CheckoutDto } from './dto/checkout.dto';
import { PlanPaymentsService } from './plan-payments.service';

@Injectable()
export class SubscriptionsCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paypalService: PaypalService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly planPayments: PlanPaymentsService,
  ) {}

  /**
   * Starts a checkout. Plans are paid with Chapa (decided 2026-11-03): one payment buys one
   * period, and the plan starts when Beleqet Pay confirms it (PlanPaymentsService). PayPal is
   * kept only to cancel subscriptions that were set up through it.
   */
  async checkout(userId: string, dto: CheckoutDto) {
    return this.planPayments.checkout(userId, dto.planId);
  }

  /**
   * Cancels the gateway-side billing agreement (stops future charges
   * immediately), then flags the local Subscription to stop access at the
   * end of the already-paid-for period.
   */
  async cancel(id: string, userId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { id } });
    if (!subscription || subscription.userId !== userId) {
      throw new NotFoundException('Subscription not found');
    }

    const updatedSubscription = await this.subscriptionsService.cancel(id, userId);

    if (subscription.provider === PaymentProvider.PAYPAL && subscription.providerSubscriptionId) {
      try {
        await this.paypalService.cancelSubscription(subscription.providerSubscriptionId);
      } catch (error) {
        // Rollback local state if gateway cancellation fails
        await this.prisma.subscription.update({
          where: { id },
          data: { cancelAtPeriodEnd: subscription.cancelAtPeriodEnd },
        });
        throw error;
      }
    }

    return updatedSubscription;
  }
}
