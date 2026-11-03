import { PaymentProvider, Prisma } from '@prisma/client';
import { addInterval } from './subscriptions.service';

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
      data: { currentPeriodEnd: addInterval(running.currentPeriodEnd, plan.interval), cancelAtPeriodEnd: false, reminderSentAt: null },
    });
    return running.id;
  }
  await tx.subscription.updateMany({
    where: { userId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
    data: { status: 'CANCELLED' },
  });
  const created = await tx.subscription.create({
    data: { userId, planId, status: 'ACTIVE', provider, currentPeriodStart: now, currentPeriodEnd: addInterval(now, plan.interval) },
  });
  return created.id;
}
