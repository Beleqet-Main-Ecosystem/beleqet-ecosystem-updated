import { ConflictException } from '@nestjs/common';
import { PaymentProvider, Prisma } from '@prisma/client';
import { addInterval } from './subscriptions.service';

/**
 * Refuses a one-off plan payment (Chapa or bank transfer) while a PayPal subscription is still
 * renewing: activatePaidPlan would end it here, but PayPal would keep charging the card.
 */
export async function assertNoPaypalAutoRenew(
  db: Pick<Prisma.TransactionClient, 'subscription'>,
  userId: string,
): Promise<void> {
  const renewing = await db.subscription.findFirst({
    where: {
      userId,
      provider: PaymentProvider.PAYPAL,
      status: { in: ['ACTIVE', 'PAST_DUE'] },
      cancelAtPeriodEnd: false,
    },
    select: { id: true },
  });
  if (renewing) {
    throw new ConflictException(
      'Your plan renews through PayPal. Cancel it first, then pay another way.',
    );
  }
}

/**
 * After a plan is paid for (Chapa, or a bank transfer an admin approved): add a period to the
 * same plan if it is still running, otherwise end any other running plan and start this one.
 * One subscription at a time. Runs inside the caller's transaction; returns the subscription id.
 */
export async function activatePaidPlan(
  tx: Prisma.TransactionClient,
  userId: string,
  planId: string,
  provider: PaymentProvider,
): Promise<string> {
  const plan = await tx.plan.findUniqueOrThrow({ where: { id: planId } });
  const now = new Date();
  const running = await tx.subscription.findFirst({
    where: { userId, planId, status: 'ACTIVE', currentPeriodEnd: { gt: now } },
    orderBy: { currentPeriodEnd: 'desc' },
  });
  if (running) {
    await tx.subscription.update({
      where: { id: running.id },
      data: {
        currentPeriodEnd: addInterval(running.currentPeriodEnd, plan.interval),
        cancelAtPeriodEnd: false,
        reminderSentAt: null,
      },
    });
    return running.id;
  }
  await tx.subscription.updateMany({
    where: { userId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
    data: { status: 'CANCELLED' },
  });
  const created = await tx.subscription.create({
    data: {
      userId,
      planId,
      status: 'ACTIVE',
      provider,
      currentPeriodStart: now,
      currentPeriodEnd: addInterval(now, plan.interval),
    },
  });
  return created.id;
}
