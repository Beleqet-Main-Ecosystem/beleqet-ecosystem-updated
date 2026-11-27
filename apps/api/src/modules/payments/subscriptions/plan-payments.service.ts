import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { isBeleqetPayRef } from '../beleqet-pay/beleqet-pay.service';
import { PaymentCheck, PaymentGateway } from '../gateway/payment-gateway.service';
import { activatePaidPlan, assertNoPaypalAutoRenew } from './activate-plan';
import { primaryFrontendUrl } from '../../../common/utils/frontend-url';

/**
 * Paying for a plan online: Telebirr, CBE Birr, banks or cards on Chapa's page, either directly or
 * through Beleqet Pay (PAYMENTS_VIA). There's no automatic monthly billing, so each payment buys
 * one period; paying again adds the next. The plan starts only after the provider itself confirms
 * the payment, server to server.
 */
@Injectable()
export class PlanPaymentsService {
  private readonly logger = new Logger(PlanPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGateway,
    private readonly config: ConfigService,
  ) {}

  /** Opens a checkout for one period of the plan; returns where to send the browser. */
  async checkout(userId: string, planId: string) {
    const plan = await this.prisma.plan.findFirst({ where: { id: planId, isActive: true } });
    if (!plan) throw new NotFoundException('Plan not found or inactive');
    if (plan.priceAmount <= 0) throw new BadRequestException('The free plan needs no payment');
    await assertNoPaypalAutoRenew(this.prisma, userId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    // The payment's reference is Chapa's tx_ref, so Chapa's callback finds it. Through Beleqet Pay
    // it becomes Pay's txRef once the session exists.
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        provider: PaymentProvider.CHAPA,
        providerPaymentId: `CHAPA-${randomUUID()}`,
        amount: plan.priceAmount,
        currency: plan.currency,
        status: PaymentStatus.PENDING,
        description: `${plan.name} plan`,
        metadata: { planId: plan.id },
      },
    });

    const frontend = primaryFrontendUrl(this.config.get<string>('FRONTEND_URL'));
    try {
      const { checkoutUrl, providerRef } = await this.gateway.openCheckout({
        // Plan prices are kept in santim; Chapa and Pay take birr.
        amount: (plan.priceAmount / 100).toFixed(2),
        currency: plan.currency,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        reference: payment.providerPaymentId,
        // The id is in the path: query strings on the return address don't survive Chapa's redirect.
        returnUrl: `${frontend}/payment/chapa/${payment.id}`,
        title: 'Beleqet Jobs',
        description: `${plan.name} plan`,
        metadata: { kind: 'plan', planPaymentId: payment.id },
      });
      if (providerRef !== payment.providerPaymentId) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { providerPaymentId: providerRef },
        });
      }
      return { paymentId: payment.id, checkoutUrl };
    } catch (err) {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED },
      });
      throw err;
    }
  }

  /**
   * Called for a payment event (Chapa's or Beleqet Pay's) that matched no escrow. Returns false when
   * it isn't a plan payment either. A success is re-checked with the provider (status, amount and
   * currency, and for Pay that it pays for this payment) before the plan starts, and a payment
   * starts its plan only once however often the event arrives.
   */
  async handlePaymentEvent(event: {
    txRef: string;
    externalRef?: string;
    successful: boolean;
  }): Promise<boolean> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        provider: PaymentProvider.CHAPA,
        OR: [
          { providerPaymentId: event.txRef },
          ...(event.externalRef ? [{ id: event.externalRef }] : []),
        ],
      },
    });
    if (!payment) return false;
    if (payment.status === PaymentStatus.SUCCEEDED) return true;

    if (!event.successful) {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.FAILED },
      });
      return true;
    }

    // Pay's event names its own transaction, even if saving it on the payment never happened.
    const ref = isBeleqetPayRef(event.txRef) ? event.txRef : payment.providerPaymentId;
    const result = await this.gateway.paymentResult(ref);
    if (result.state !== 'success' || !this.paidInFull(payment, result)) {
      throw new Error(
        `Plan payment ${payment.id} not confirmed: status=${result.state} amount=${result.amount} ${result.currency}`,
      );
    }
    await this.startPlan(payment);
    return true;
  }

  /**
   * The caller's own payment, for the page payers come back to. While it is still open, the
   * provider is asked directly, so a late or lost callback doesn't leave the payer waiting.
   */
  async status(userId: string, paymentId: string) {
    const select = { id: true, status: true, amount: true, currency: true, createdAt: true };
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, userId } });
    if (!payment) throw new NotFoundException('Payment not found');
    await this.checkWithProvider(payment);
    return this.prisma.payment.findFirstOrThrow({ where: { id: payment.id }, select });
  }

  /**
   * Asks the provider about the caller's plan payments from the last day that are still open, so a
   * paid plan starts even if the payer never came back to the return page.
   */
  async confirmRecent(userId: string) {
    const open = await this.prisma.payment.findMany({
      where: {
        userId,
        provider: PaymentProvider.CHAPA,
        status: PaymentStatus.PENDING,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    for (const payment of open) await this.checkWithProvider(payment);
  }

  /** Chapa or Beleqet Pay, whichever made the payment (Pay's references start with TX-BLQ-). */
  private async checkWithProvider(payment: Payment) {
    if (payment.status !== PaymentStatus.PENDING || payment.provider !== PaymentProvider.CHAPA) {
      return;
    }
    try {
      const result = await this.gateway.paymentResult(payment.providerPaymentId);
      if (result.state === 'success' && this.paidInFull(payment, result)) {
        await this.startPlan(payment);
      } else if (result.state === 'failed') {
        await this.prisma.payment.updateMany({
          where: { id: payment.id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.FAILED },
        });
      }
    } catch (err) {
      // Chapa doesn't know a payment until the payer opens its page; keep waiting.
      this.logger.debug(`Provider check for payment ${payment.id}: ${(err as Error).message}`);
    }
  }

  /** The full price, in the payment's currency; through Pay, also a payment made for this one. */
  private paidInFull(payment: Payment, result: PaymentCheck) {
    const forThisPayment = !result.metadata || result.metadata.planPaymentId === payment.id;
    return (
      forThisPayment &&
      Number.isFinite(result.amount) &&
      Math.abs(result.amount - payment.amount / 100) < 0.01 &&
      (!result.currency || result.currency === payment.currency)
    );
  }

  private async startPlan(payment: Payment) {
    const planId = (payment.metadata as { planId?: string } | null)?.planId;
    if (!planId) throw new Error(`Plan payment ${payment.id} has no plan`);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: PaymentStatus.SUCCEEDED } },
        data: { status: PaymentStatus.SUCCEEDED },
      });
      if (count === 0) return;
      const subscriptionId = await activatePaidPlan(
        tx,
        payment.userId,
        planId,
        PaymentProvider.CHAPA,
      );
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          metadata: {
            planId,
            subscriptionId,
            verifiedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });
      this.logger.log(
        `Plan payment ${payment.id} confirmed; plan ${planId} active for ${payment.userId}`,
      );
    });
  }
}
