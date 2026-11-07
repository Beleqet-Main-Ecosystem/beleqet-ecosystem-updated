import { ConflictException } from '@nestjs/common';
import { PlanPaymentsService } from './plan-payments.service';

describe('PlanPaymentsService', () => {
  const pro = {
    id: 'pro',
    name: 'Pro',
    priceAmount: 99_900,
    currency: 'ETB',
    isActive: true,
    interval: 'MONTHLY',
  };
  let prisma: Record<string, any>;
  let chapa: { checkoutUrl: jest.Mock; paymentResult: jest.Mock };
  let service: PlanPaymentsService;

  beforeEach(() => {
    prisma = {
      plan: {
        findFirst: jest.fn().mockResolvedValue(pro),
        findUniqueOrThrow: jest.fn().mockResolvedValue(pro),
      },
      user: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ email: 'emp@example.com', firstName: 'Abebe', lastName: 'Kebede' }),
      },
      payment: {
        create: jest.fn().mockResolvedValue({ id: 'pay-1', providerPaymentId: 'CHAPA-9' }),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn(),
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'SUCCEEDED' }),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'sub-1' }),
        update: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
    chapa = {
      checkoutUrl: jest.fn().mockResolvedValue('https://checkout.chapa.co/c/9'),
      paymentResult: jest
        .fn()
        .mockResolvedValue({ state: 'success', amount: 999, currency: 'ETB', raw: {} }),
    };
    service = new PlanPaymentsService(
      prisma as never,
      chapa as never,
      { get: () => 'https://web.test' } as never,
    );
  });

  const pending = {
    id: 'pay-1',
    userId: 'u1',
    provider: 'CHAPA',
    providerPaymentId: 'CHAPA-9',
    amount: 99_900,
    currency: 'ETB',
    status: 'PENDING',
    metadata: { planId: 'pro' },
  };

  it('opens a Chapa checkout for the plan price in birr', async () => {
    await expect(service.checkout('u1', 'pro')).resolves.toEqual({
      paymentId: 'pay-1',
      checkoutUrl: 'https://checkout.chapa.co/c/9',
    });
    expect(chapa.checkoutUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '999.00',
        currency: 'ETB',
        email: 'emp@example.com',
        firstName: 'Abebe',
        txRef: 'CHAPA-9',
        returnUrl: 'https://web.test/employer?tab=plan&payment=pay-1',
      }),
    );
  });

  it('marks the payment failed when Chapa will not open a checkout', async () => {
    chapa.checkoutUrl.mockRejectedValue(new Error('Chapa down'));
    await expect(service.checkout('u1', 'pro')).rejects.toThrow('Chapa down');
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay-1', status: 'PENDING' },
      data: { status: 'FAILED' },
    });
  });

  it('refuses while a PayPal subscription is still renewing, so PayPal never charges for a plan that ended', async () => {
    prisma.subscription.findFirst.mockResolvedValueOnce({ id: 'sub-pp' });
    await expect(service.checkout('u1', 'pro')).rejects.toThrow(ConflictException);
    expect(prisma.subscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'u1',
          provider: 'PAYPAL',
          cancelAtPeriodEnd: false,
        }),
      }),
    );
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('starts the plan once Chapa confirms the payment', async () => {
    prisma.payment.findFirst.mockResolvedValue(pending);
    await expect(service.handlePaymentEvent({ txRef: 'CHAPA-9', successful: true })).resolves.toBe(
      true,
    );
    expect(chapa.paymentResult).toHaveBeenCalledWith('CHAPA-9');
    expect(prisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          planId: 'pro',
          status: 'ACTIVE',
          provider: 'CHAPA',
        }),
      }),
    );
  });

  it('refuses a payment whose confirmed amount is wrong', async () => {
    prisma.payment.findFirst.mockResolvedValue(pending);
    chapa.paymentResult.mockResolvedValue({
      state: 'success',
      amount: 1,
      currency: 'ETB',
      raw: {},
    });
    await expect(
      service.handlePaymentEvent({ txRef: 'CHAPA-9', successful: true }),
    ).rejects.toThrow('not confirmed');
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('starts the plan only once when the event arrives twice', async () => {
    prisma.payment.findFirst.mockResolvedValue(pending);
    prisma.payment.updateMany.mockResolvedValue({ count: 0 });
    await service.handlePaymentEvent({ txRef: 'CHAPA-9', successful: true });
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('marks a failed payment and tells the caller it was a plan payment', async () => {
    prisma.payment.findFirst.mockResolvedValue(pending);
    await expect(service.handlePaymentEvent({ txRef: 'CHAPA-9', successful: false })).resolves.toBe(
      true,
    );
    expect(prisma.payment.updateMany).toHaveBeenCalledWith({
      where: { id: 'pay-1', status: 'PENDING' },
      data: { status: 'FAILED' },
    });
  });

  it('says false for an event that is not a plan payment', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    await expect(service.handlePaymentEvent({ txRef: 'other', successful: true })).resolves.toBe(
      false,
    );
  });

  it('refuses a payment Chapa reports in another currency', async () => {
    prisma.payment.findFirst.mockResolvedValue(pending);
    chapa.paymentResult.mockResolvedValue({
      state: 'success',
      amount: 999,
      currency: 'USD',
      raw: {},
    });
    await expect(
      service.handlePaymentEvent({ txRef: 'CHAPA-9', successful: true }),
    ).rejects.toThrow('not confirmed');
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  describe('status, while the payer waits on the plan page', () => {
    it('asks Chapa and starts the plan when Chapa says it is paid', async () => {
      prisma.payment.findFirst.mockResolvedValue(pending);
      await expect(service.status('u1', 'pay-1')).resolves.toEqual({
        id: 'pay-1',
        status: 'SUCCEEDED',
      });
      expect(chapa.paymentResult).toHaveBeenCalledWith('CHAPA-9');
      expect(prisma.subscription.create).toHaveBeenCalled();
    });

    it('marks it failed when Chapa says so', async () => {
      prisma.payment.findFirst.mockResolvedValue(pending);
      chapa.paymentResult.mockResolvedValue({
        state: 'failed',
        amount: NaN,
        currency: '',
        raw: {},
      });
      await service.status('u1', 'pay-1');
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'pay-1', status: 'PENDING' },
        data: { status: 'FAILED' },
      });
      expect(prisma.subscription.create).not.toHaveBeenCalled();
    });

    it('keeps waiting while Chapa does not know the payment yet', async () => {
      prisma.payment.findFirst.mockResolvedValue(pending);
      chapa.paymentResult.mockRejectedValue(new Error('Transaction not found'));
      await expect(service.status('u1', 'pay-1')).resolves.toBeDefined();
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('does not ask Chapa about a finished payment', async () => {
      prisma.payment.findFirst.mockResolvedValue({ ...pending, status: 'SUCCEEDED' });
      await service.status('u1', 'pay-1');
      expect(chapa.paymentResult).not.toHaveBeenCalled();
    });

    it("never shows another user's payment", async () => {
      prisma.payment.findFirst.mockResolvedValue(null);
      await expect(service.status('u2', 'pay-1')).rejects.toThrow('Payment not found');
      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { id: 'pay-1', userId: 'u2' },
      });
    });
  });
});
