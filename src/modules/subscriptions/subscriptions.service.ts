import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentGatewayService } from './payment-gateway.service';
import { SubscribeDto, BillingInterval } from './dto/subscribe.dto';
import { Prisma } from '@prisma/client';

/**
 * Service managing subscription plans, user subscriptions, invoices, 
 * proration logic, and payment webhook updates.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGatewayService,
  ) {}

  /**
   * List all active subscription plans.
   * Supports i18n localization of name and description based on accept-language.
   * @param lang Preferred language code (e.g. 'en', 'am')
   */
  async getPlans(lang: string = 'en') {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      include: { prices: true },
    });

    return plans.map((plan) => {
      const nameObj = plan.name as Record<string, string>;
      const descObj = plan.description as Record<string, string>;
      return {
        ...plan,
        name: nameObj?.[lang] || nameObj?.['en'] || plan.slug,
        description: descObj?.[lang] || descObj?.['en'] || '',
      };
    });
  }

  /**
   * Retrieve active subscription for a specific user.
   * @param userId UUID of the user
   */
  async getUserSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });
    if (!subscription) {
      // Fallback to implicit free subscription
      const freePlan = await this.prisma.subscriptionPlan.findUnique({
        where: { slug: 'free' },
      });
      if (!freePlan) throw new NotFoundException('Free subscription plan not seeded');
      return {
        status: 'INACTIVE',
        plan: freePlan,
        currency: 'ETB',
        amount: 0,
        billingInterval: 'MONTHLY',
        cancelAtPeriodEnd: false,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
    }
    return subscription;
  }

  /**
   * Initiate a subscription creation, renewal, or upgrade/downgrade.
   * Calculates proration if there is an active subscription.
   * @param userId UUID of the subscribing user
   * @param dto Subscription target plan details
   */
  async subscribe(userId: string, dto: SubscribeDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId },
      include: { prices: true },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    const price = plan.prices.find((p) => p.id === dto.priceId && p.currency === dto.currency);
    if (!price) throw new NotFoundException('Price not found for selected plan and currency');

    // ── Proration & Upgrade Safety Check ──
    const existingSub = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { price: true },
    });

    let finalAmount = price.amount;
    let prorationCredit = 0;

    if (existingSub && existingSub.status === 'ACTIVE') {
      const now = new Date();
      const totalDuration = existingSub.currentPeriodEnd.getTime() - existingSub.currentPeriodStart.getTime();
      const timeRemaining = existingSub.currentPeriodEnd.getTime() - now.getTime();

      if (timeRemaining > 0 && totalDuration > 0) {
        // Calculate remaining credit (remaining time ratio * paid amount)
        const ratio = timeRemaining / totalDuration;
        prorationCredit = Math.floor(existingSub.amount * ratio);
        
        if (existingSub.currency === dto.currency) {
          finalAmount = Math.max(0, price.amount - prorationCredit);
          this.logger.log(`Prorating: original amount ${price.amount}, credit ${prorationCredit}, final to pay ${finalAmount}`);
        } else {
          this.logger.warn(`Proration skipped due to currency mismatch: existing ${existingSub.currency}, target ${dto.currency}`);
        }
      }
    }

    // Generate unique invoice/tx reference
    const invoiceId = `sub-inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Create a pending subscription (or update existing)
    const currentPeriodEnd = new Date(
      Date.now() + (price.interval === BillingInterval.YEARLY ? 365 : 30) * 24 * 60 * 60 * 1000
    );

    const subscription = await this.prisma.subscription.upsert({
      where: { userId },
      update: {
        planId: plan.id,
        priceId: price.id,
        currency: dto.currency,
        amount: price.amount,
        billingInterval: price.interval,
        status: finalAmount === 0 ? 'ACTIVE' : 'UNPAID', // If free after proration, mark active
        currentPeriodStart: new Date(),
        currentPeriodEnd,
      },
      create: {
        userId,
        planId: plan.id,
        priceId: price.id,
        status: finalAmount === 0 ? 'ACTIVE' : 'UNPAID',
        currency: dto.currency,
        amount: price.amount,
        billingInterval: price.interval,
        currentPeriodEnd,
      },
    });

    // Save invoice record
    const invoice = await this.prisma.subscriptionInvoice.create({
      data: {
        subscriptionId: subscription.id,
        gatewayTxRef: invoiceId,
        amount: finalAmount,
        currency: dto.currency,
        status: finalAmount === 0 ? 'PAID' : 'PENDING',
        paidAt: finalAmount === 0 ? new Date() : null,
      },
    });

    if (finalAmount === 0) {
      this.logger.log(`Subscription activated instantly for user ${userId} (0 payment required due to proration/free plan)`);
      return { checkoutUrl: null, status: 'ACTIVE', invoiceId: invoice.id };
    }

    // Call payment gateway
    let checkoutUrl = '';
    if (dto.currency === 'ETB') {
      // Chapa
      checkoutUrl = await this.gateway.initializeChapaTransaction({
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        amount: finalAmount,
        currency: dto.currency,
        txRef: invoiceId,
        planName: (plan.name as Record<string, string>)?.en || plan.slug,
      });
    } else {
      // Stripe (or global fallback)
      checkoutUrl = await this.gateway.createStripeCheckoutSession({
        email: user.email,
        priceId: price.gatewayPriceId || 'mock_price_id',
        successUrl: `${this.configUrl()}/subscriptions/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${this.configUrl()}/subscriptions/payment-failed`,
        metadata: {
          txRef: invoiceId,
          userId,
          planId: plan.id,
          priceId: price.id,
        },
      });
    }

    return { checkoutUrl, status: 'PENDING', invoiceId: invoice.id };
  }

  /**
   * Cancel user's subscription at period end.
   */
  async cancelSubscription(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) throw new NotFoundException('No active subscription found');

    return this.prisma.subscription.update({
      where: { userId },
      data: {
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
      },
    });
  }

  /**
   * Process Chapa transaction success webhook.
   */
  async processChapaWebhook(payload: { tx_ref: string; status: string; [k: string]: any }) {
    if (payload.status !== 'success') {
      this.logger.warn(`Chapa subscription webhook failed or pending: ${payload.tx_ref}`);
      return { success: false };
    }

    const invoice = await this.prisma.subscriptionInvoice.findUnique({
      where: { gatewayTxRef: payload.tx_ref },
      include: { subscription: true },
    });

    if (!invoice) {
      this.logger.error(`Invoice not found for reference: ${payload.tx_ref}`);
      return { success: false };
    }

    if (invoice.status === 'PAID') {
      return { success: true, message: 'Already processed' };
    }

    await this.prisma.$transaction([
      this.prisma.subscriptionInvoice.update({
        where: { id: invoice.id },
        data: { status: 'PAID', paidAt: new Date() },
      }),
      this.prisma.subscription.update({
        where: { id: invoice.subscriptionId },
        data: { status: 'ACTIVE' },
      }),
    ]);

    this.logger.log(`Subscription active via Chapa: invoice ${invoice.id}, sub ${invoice.subscriptionId}`);
    return { success: true };
  }

  /**
   * Process Stripe Event Webhook
   */
  async processStripeWebhook(event: any) {
    this.logger.log(`Received Stripe Webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const txRef = session.metadata?.txRef;
        if (txRef) {
          const invoice = await this.prisma.subscriptionInvoice.findUnique({
            where: { gatewayTxRef: txRef },
          });
          if (invoice) {
            await this.prisma.$transaction([
              this.prisma.subscriptionInvoice.update({
                where: { id: invoice.id },
                data: { status: 'PAID', paidAt: new Date() },
              }),
              this.prisma.subscription.update({
                where: { id: invoice.subscriptionId },
                data: { status: 'ACTIVE', gatewaySubscriptionId: session.subscription as string },
              }),
            ]);
            this.logger.log(`Stripe subscription activated for invoice: ${txRef}`);
          }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object;
        const sub = await this.prisma.subscription.findFirst({
          where: { gatewaySubscriptionId: stripeSub.id },
        });
        if (sub) {
          await this.prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'EXPIRED', endedAt: new Date() },
          });
          this.logger.log(`Stripe subscription deleted/expired: ${stripeSub.id}`);
        }
        break;
      }
      // Add other stripe handlers if necessary (invoice.payment_failed etc.)
    }

    return { received: true };
  }

  /**
   * Export all user invoices (GDPR compatibility)
   */
  async getUserInvoices(userId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { userId } });
    if (!sub) return [];

    return this.prisma.subscriptionInvoice.findMany({
      where: { subscriptionId: sub.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Enforces quantitative limits based on the user's active subscription.
   * If user exceeds limits, throws ForbiddenException.
   * Falls back to "Free" plan limits if no active subscription.
   * @param userId UUID of the user
   * @param limitKey Key representing limit (e.g. 'maxJobs')
   */
  async checkUserLimit(userId: string, limitKey: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    let planLimits: Record<string, any>;
    let planSlug = 'free';

    if (sub && sub.status === 'ACTIVE') {
      planLimits = sub.plan.limits as Record<string, any>;
      planSlug = sub.plan.slug;
    } else {
      // Fallback to Free plan
      const freePlan = await this.prisma.subscriptionPlan.findUnique({
        where: { slug: 'free' },
      });
      if (!freePlan) throw new NotFoundException('Default Free plan not found');
      planLimits = freePlan.limits as Record<string, any>;
    }

    const limit = planLimits[limitKey];
    if (limit === undefined) return; // No limit defined for this key

    if (limitKey === 'maxJobs') {
      if (!user.company) return; // If they don't have a company profile, other checks will catch it
      const activeJobsCount = await this.prisma.job.count({
        where: {
          companyId: user.company.id,
          status: { not: 'ARCHIVED' },
        },
      });

      if (activeJobsCount >= limit) {
        throw new ForbiddenException(
          `Your active subscription (${planSlug}) allows up to ${limit} active jobs. You currently have ${activeJobsCount} active jobs.`
        );
      }
    }
  }

  /**
   * Helper to fetch frontend URL
   */
  private configUrl(): string {
    return 'http://localhost:3000';
  }

  // ── ADMIN ENDPOINTS ────────────────────────────────────────────────────────

  /**
   * Create a new subscription plan with prices (Admin).
   */
  async createPlan(data: any) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.create({
        data: {
          slug: data.slug,
          name: data.name,
          description: data.description,
          features: data.features,
          limits: data.limits,
          isActive: data.isActive ?? true,
        },
      });

      if (data.prices && Array.isArray(data.prices)) {
        for (const price of data.prices) {
          await tx.subscriptionPlanPrice.create({
            data: {
              planId: plan.id,
              currency: price.currency,
              amount: price.amount,
              interval: price.interval,
              gatewayPriceId: price.gatewayPriceId,
            },
          });
        }
      }

      return tx.subscriptionPlan.findUnique({
        where: { id: plan.id },
        include: { prices: true },
      });
    });
  }
}
