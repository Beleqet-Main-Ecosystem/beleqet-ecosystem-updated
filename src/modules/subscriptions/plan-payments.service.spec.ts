import { ConflictException } from '@nestjs/common';
import { PlanPaymentsService } from './plan-payments.service';

describe('PlanPaymentsService', () => {
  const pro = { id: 'pro', name: 'Pro', priceAmount: 99_900, currency: 'ETB', isActive: true, interval: 'MONTHLY' };
  let prisma: Record<string, any>;
  let paySwitch: { createCheckoutSession: jest.Mock; getTransaction: jest.Mock };
  let service: PlanPaymentsService;

  beforeEach(() => {
    prisma = {
      plan: { findFirst: jest.fn().mockResolvedValue(pro), findUniqueOrThrow: jest.fn().mockResolvedValue(pro) },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ email: 'emp@example.com' }) },
      payment: {
        create: jest.fn().mockResolvedValue({ id: 'pay-1' }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'sub-1' }),
        update: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
    paySwitch = {
      createCheckoutSession: jest.fn().mockResolvedValue({ txRef: 'bp-tx-9', checkoutUrl: 'https://pay.test/c/9' }),
      getTransaction: jest.fn().mockResolvedValue({ status: 'SUCCESS', amount: '999.00' }),
    };
    service = new PlanPaymentsService(prisma as never, paySwitch as never, { get: () => 'https://web.test' } as never);
  });

  const pending = { id: 'pay-1', userId: 'u1', provider: 'CHAPA', providerPaymentId: 'bp-tx-9', amount: 99_900, status: 'PENDING', metadata: { planId: 'pro' } };

  it('opens a Chapa checkout for the plan price in birr', async () => {
    await expect(service.checkout('u1', 'pro')).resolves.toEqual({ paymentId: 'pay-1', checkoutUrl: 'https://pay.test/c/9' });
    expect(paySwitch.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '999.00', preferredProvider: 'CHAPA', externalRef: 'pay-1', successRedirectUrl: 'https://web.test/employer?tab=plan&payment=pay-1' }),
    );
    expect(prisma.payment.update).toHaveBeenCalledWith({ where: { id: 'pay-1' }, data: { providerPaymentId: 'bp-tx-9' } });
  });

  it('refuses while a PayPal subscription is still renewing, so PayPal never charges for a plan that ended', async () => {
    prisma.subscription.findFirst.mockResolvedValueOnce({ id: 'sub-pp' });
    await expect(service.checkout('u1', 'pro')).rejects.toThrow(ConflictException);
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1', provider: 'PAYPAL', cancelAtPeriodEnd: false }) }),
    );
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('starts the plan once Beleqet Pay confirms the payment', async () => {
    prisma.payment.findFirst.mockResolvedValue(pending);
    await expect(service.handlePaymentEvent({ txRef: 'bp-tx-9', successful: true })).resolves.toBe(true);
    expect(paySwitch.getTransaction).toHaveBeenCalledWith('bp-tx-9');
    expect(prisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', planId: 'pro', status: 'ACTIVE', provider: 'CHAPA' }) }),
    );
  });

  it('refuses a payment whose confirmed amount is wrong', async () => {
    prisma.payment.findFirst.mockResolvedValue(pending);
    paySwitch.getTransaction.mockResolvedValue({ status: 'SUCCESS', amount: '1.00' });
    await expect(service.handlePaymentEvent({ txRef: 'bp-tx-9', successful: true })).rejects.toThrow('not confirmed');
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('starts the plan only once when the event arrives twice', async () => {
    prisma.payment.findFirst.mockResolvedValue(pending);
    prisma.payment.updateMany.mockResolvedValue({ count: 0 });
    await service.handlePaymentEvent({ txRef: 'bp-tx-9', successful: true });
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('marks a failed payment and tells the caller it was a plan payment', async () => {
    prisma.payment.findFirst.mockResolvedValue(pending);
    await expect(service.handlePaymentEvent({ txRef: 'bp-tx-9', successful: false })).resolves.toBe(true);
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({ where: { id: 'pay-1', status: 'PENDING' }, data: { status: 'FAILED' } });
  });

  it('says false for an event that is not a plan payment', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    await expect(service.handlePaymentEvent({ txRef: 'other', successful: true })).resolves.toBe(false);
  });
});
