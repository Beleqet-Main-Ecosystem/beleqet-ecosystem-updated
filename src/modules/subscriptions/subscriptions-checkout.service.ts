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

@Injectable()
export class SubscriptionsCheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paypalService: PaypalService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /**
   * Starts a checkout: creates the PayPal billing agreement, then a local
   * PENDING Subscription linked to it. The Subscription is promoted to
   * ACTIVE by BillingService once the BILLING.SUBSCRIPTION.ACTIVATED
   * webhook arrives (see billing.service.ts).
   */
  async checkout(userId: string, dto: CheckoutDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Plan not found or inactive');
    if (!plan.paypalPlanId) {
      throw new BadRequestException('This plan is not yet configured for checkout');
    }

    await this.subscriptionsService.assertNoActiveSubscription(userId);

    const result = await this.paypalService.createSubscription({
      userId,
      amount: plan.priceAmount / 100,
      currency: plan.currency,
      subscriptionPlanId: plan.paypalPlanId,
      description: `Beleqet ${plan.name} subscription`,
    });

    const subscription = await this.subscriptionsService.createPendingCheckout({
      userId,
      planId: plan.id,
      provider: PaymentProvider.PAYPAL,
      providerSubscriptionId: result.id,
    });

    return { subscription, approvalUrl: result.approvalUrl };
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
