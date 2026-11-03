import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { BeleqetPayService } from '../beleqet-pay/beleqet-pay.service';
import { activatePaidPlan } from './activate-plan';

/**
 * Paying for a plan with Chapa (through Beleqet Pay): Telebirr, CBE Birr, banks or cards. Chapa
 * has no automatic monthly billing, so each payment buys one period; paying again adds the next.
 * The plan starts only after Beleqet Pay confirms the payment server to server.
 */
@Injectable()
export class PlanPaymentsService {
  private readonly logger = new Logger(PlanPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paySwitch: BeleqetPayService,
    private readonly config: ConfigService,
  ) {}

  /** Opens a Chapa checkout for one period of the plan; returns where to send the browser. */
  async checkout(userId: string, planId: string) {
    const plan = await this.prisma.plan.findFirst({ where: { id: planId, isActive: true } });
    if (!plan) throw new NotFoundException('Plan not found or inactive');
    if (plan.priceAmount <= 0) throw new BadRequestException('The free plan needs no payment');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });

    // Plan prices are kept in santim; Beleqet Pay takes birr.
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

    const frontend = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:4001';
    const session = await this.paySwitch.createCheckoutSession({
      amount: (plan.priceAmount / 100).toFixed(2),
      currency: plan.currency,
      customerEmail: user.email,
      preferredProvider: 'CHAPA',
      successRedirectUrl: `${frontend}/employer?tab=plan&payment=${payment.id}`,
      externalRef: payment.id,
    });
    await this.prisma.payment.update({ where: { id: payment.id }, data: { providerPaymentId: session.txRef } });
    return { paymentId: payment.id, checkoutUrl: session.checkoutUrl };
  }

  /**
   * Called for a Chapa event that matched no escrow. Returns false when it isn't a plan payment
   * either. A success is re-checked with Beleqet Pay (status and amount) before the plan starts,
   * and a payment starts its plan only once however often the event arrives.
   */
  async handlePaymentEvent(event: { txRef: string; externalRef?: string; successful: boolean }): Promise<boolean> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        provider: PaymentProvider.CHAPA,
        OR: [{ providerPaymentId: event.txRef }, ...(event.externalRef ? [{ id: event.externalRef }] : [])],
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

    const verified = await this.paySwitch.getTransaction(payment.providerPaymentId);
    const paid = Number(verified.amount);
    if (verified.status !== 'SUCCESS' || !Number.isFinite(paid) || Math.abs(paid - payment.amount / 100) >= 0.01) {
      throw new Error(`Plan payment ${payment.id} not confirmed: status=${verified.status} amount=${verified.amount}`);
    }

    const planId = (payment.metadata as { planId?: string } | null)?.planId;
    if (!planId) throw new Error(`Plan payment ${payment.id} has no plan`);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.payment.updateMany({
        where: { id: payment.id, status: { not: PaymentStatus.SUCCEEDED } },
        data: { status: PaymentStatus.SUCCEEDED },
      });
      if (count === 0) return;
      const subscriptionId = await activatePaidPlan(tx, payment.userId, planId, PaymentProvider.CHAPA);
      await tx.payment.update({
        where: { id: payment.id },
        data: { metadata: { planId, subscriptionId, verifiedAt: new Date().toISOString() } as Prisma.InputJsonValue },
      });
    });
    this.logger.log(`Plan payment ${payment.id} confirmed; plan ${planId} active for ${payment.userId}`);
    return true;
  }

  /** The caller's own payment, for the page Chapa sends people back to. */
  async status(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, userId },
      select: { id: true, status: true, amount: true, currency: true, createdAt: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }
}
