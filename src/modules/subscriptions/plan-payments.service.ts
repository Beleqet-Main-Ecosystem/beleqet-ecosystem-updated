import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ChapaClient } from '../chapa/chapa.client';
import { activatePaidPlan, assertNoPaypalAutoRenew } from './activate-plan';
import { primaryFrontendUrl } from '../../common/utils/frontend-url';

/**
 * Paying for a plan with Chapa: Telebirr, CBE Birr, banks or cards. Chapa has no automatic
 * monthly billing, so each payment buys one period; paying again adds the next. The plan starts
 * only after Chapa itself confirms the payment, server to server.
 */
@Injectable()
export class PlanPaymentsService {
  private readonly logger = new Logger(PlanPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chapa: ChapaClient,
    private readonly config: ConfigService,
  ) {}

  /** Opens a Chapa checkout for one period of the plan; returns where to send the browser. */
  async checkout(userId: string, planId: string) {
    const plan = await this.prisma.plan.findFirst({ where: { id: planId, isActive: true } });
    if (!plan) throw new NotFoundException('Plan not found or inactive');
    if (plan.priceAmount <= 0) throw new BadRequestException('The free plan needs no payment');
    await assertNoPaypalAutoRenew(this.prisma, userId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true },
    });

    // The payment's reference is also Chapa's tx_ref, so Chapa's callback finds it.
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
      const checkoutUrl = await this.chapa.checkoutUrl({
        // Plan prices are kept in santim; Chapa takes birr.
        amount: (plan.priceAmount / 100).toFixed(2),
        currency: plan.currency,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        txRef: payment.providerPaymentId,
        returnUrl: `${frontend}/employer?tab=plan&payment=${payment.id}`,
        title: 'Beleqet Jobs',
        description: `${plan.name} plan`,
      });
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
   * Called for a Chapa event that matched no escrow. Returns false when it isn't a plan payment
   * either. A success is re-checked with Chapa (status, amount and currency) before the plan
   * starts, and a payment starts its plan only once however often the event arrives.
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

    const result = await this.chapa.paymentResult(payment.providerPaymentId);
    if (result.state !== 'success' || !this.paidInFull(payment, result)) {
      throw new Error(
        `Plan payment ${payment.id} not confirmed: status=${result.state} amount=${result.amount} ${result.currency}`,
      );
    }
    await this.startPlan(payment);
    return true;
  }

  /**
   * The caller's own payment, for the page Chapa sends people back to. While it is still open,
   * Chapa is asked directly, so a late or lost callback doesn't leave the payer waiting.
   */
  async status(userId: string, paymentId: string) {
    const select = { id: true, status: true, amount: true, currency: true, createdAt: true };
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, userId } });
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status === PaymentStatus.PENDING && payment.provider === PaymentProvider.CHAPA) {
      try {
        const result = await this.chapa.paymentResult(payment.providerPaymentId);
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
        this.logger.debug(`Chapa check for payment ${payment.id}: ${(err as Error).message}`);
      }
    }
    return this.prisma.payment.findFirstOrThrow({ where: { id: payment.id }, select });
  }

  private paidInFull(payment: Payment, result: { amount: number; currency: string }) {
    return (
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
