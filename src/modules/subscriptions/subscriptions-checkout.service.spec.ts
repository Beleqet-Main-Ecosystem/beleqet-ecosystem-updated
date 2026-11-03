import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { SubscriptionsCheckoutService } from './subscriptions-checkout.service';
import { PlanPaymentsService } from './plan-payments.service';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaypalService } from '../payments/paypal.service';

describe('SubscriptionsCheckoutService', () => {
  const planPayments = { checkout: jest.fn() };
  let service: SubscriptionsCheckoutService;
  let prisma: { plan: { findUnique: jest.Mock }; subscription: { findUnique: jest.Mock; updateMany: jest.Mock } };
  let paypalService: { createSubscription: jest.Mock; cancelSubscription: jest.Mock };
  let subscriptionsService: {
    assertNoActiveSubscription: jest.Mock;
    createPendingCheckout: jest.Mock;
    cancel: jest.Mock;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = { plan: { findUnique: jest.fn() }, subscription: { findUnique: jest.fn(), updateMany: jest.fn() } };
    paypalService = { createSubscription: jest.fn(), cancelSubscription: jest.fn() };
    subscriptionsService = {
      assertNoActiveSubscription: jest.fn(),
      createPendingCheckout: jest.fn(),
      cancel: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsCheckoutService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaypalService, useValue: paypalService },
        { provide: SubscriptionsService, useValue: subscriptionsService },
        { provide: PlanPaymentsService, useValue: planPayments },
      ],
    }).compile();

    service = module.get<SubscriptionsCheckoutService>(SubscriptionsCheckoutService);
  });

  describe('checkout', () => {
    it('pays with Chapa: hands the plan to PlanPaymentsService and returns its checkout', async () => {
      planPayments.checkout.mockResolvedValue({ paymentId: 'pay-1', checkoutUrl: 'https://pay.test/c' });
      await expect(service.checkout('user-1', { planId: 'plan-1' })).resolves.toEqual({ paymentId: 'pay-1', checkoutUrl: 'https://pay.test/c' });
      expect(planPayments.checkout).toHaveBeenCalledWith('user-1', 'plan-1');
      expect(paypalService.createSubscription).not.toHaveBeenCalled();
    });

    it('PAYPAL: creates a billing agreement and links a local PENDING subscription to it', async () => {
      prisma.plan.findUnique.mockResolvedValue({
        id: 'plan1',
        isActive: true,
        paypalPlanId: 'P-123',
        priceAmount: 99900,
        currency: 'ETB',
        name: 'Pro',
      });
      paypalService.createSubscription.mockResolvedValue({
        id: 'I-AGREEMENT',
        approvalUrl: 'https://paypal.example/approve',
      });
      subscriptionsService.createPendingCheckout.mockResolvedValue({ id: 'sub1' });

      const result = await service.checkout('user1', { planId: 'plan1', method: 'PAYPAL' });

      expect(subscriptionsService.assertNoActiveSubscription).toHaveBeenCalledWith('user1');
      expect(paypalService.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user1', subscriptionPlanId: 'P-123', amount: 999 }),
      );
      expect(subscriptionsService.createPendingCheckout).toHaveBeenCalledWith({
        userId: 'user1',
        planId: 'plan1',
        provider: PaymentProvider.PAYPAL,
        providerSubscriptionId: 'I-AGREEMENT',
      });
      expect(result).toEqual({ subscription: { id: 'sub1' }, checkoutUrl: 'https://paypal.example/approve' });
      expect(planPayments.checkout).not.toHaveBeenCalled();
    });

    it('PAYPAL: clears only its own abandoned PayPal checkouts before the one-plan check', async () => {
      prisma.plan.findUnique.mockResolvedValue({ id: 'plan1', isActive: true, paypalPlanId: 'P-123', priceAmount: 99900, currency: 'ETB', name: 'Pro' });
      paypalService.createSubscription.mockResolvedValue({ id: 'I-1', approvalUrl: 'https://paypal.example/a' });

      await service.checkout('user1', { planId: 'plan1', method: 'PAYPAL' });

      const { where, data } = prisma.subscription.updateMany.mock.calls[0][0];
      expect(where).toEqual(expect.objectContaining({ userId: 'user1', provider: PaymentProvider.PAYPAL, status: 'PENDING' }));
      expect(where.createdAt.lt.getTime()).toBeLessThanOrEqual(Date.now() - 60 * 60 * 1000);
      expect(data).toEqual({ status: 'CANCELLED' });
      expect(prisma.subscription.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
        subscriptionsService.assertNoActiveSubscription.mock.invocationCallOrder[0],
      );
    });

    it('PAYPAL: throws NotFoundException for a missing or inactive plan', async () => {
      prisma.plan.findUnique.mockResolvedValue(null);
      await expect(service.checkout('user1', { planId: 'missing', method: 'PAYPAL' })).rejects.toThrow(NotFoundException);
    });

    it('PAYPAL: throws BadRequestException when the plan has no paypalPlanId configured', async () => {
      prisma.plan.findUnique.mockResolvedValue({ id: 'plan1', isActive: true, paypalPlanId: null });
      await expect(service.checkout('user1', { planId: 'plan1', method: 'PAYPAL' })).rejects.toThrow(BadRequestException);
      expect(paypalService.createSubscription).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('cancels the PayPal billing agreement before flagging the local subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        userId: 'user1',
        provider: PaymentProvider.PAYPAL,
        providerSubscriptionId: 'I-AGREEMENT',
      });
      subscriptionsService.cancel.mockResolvedValue({ id: 'sub1', cancelAtPeriodEnd: true });

      await service.cancel('sub1', 'user1');

      expect(paypalService.cancelSubscription).toHaveBeenCalledWith('I-AGREEMENT');
      expect(subscriptionsService.cancel).toHaveBeenCalledWith('sub1', 'user1');
    });

    it('throws NotFoundException when the subscription belongs to another user', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub1', userId: 'someone-else' });
      await expect(service.cancel('sub1', 'user1')).rejects.toThrow(NotFoundException);
      expect(paypalService.cancelSubscription).not.toHaveBeenCalled();
    });

    it("cancels a PAST_DUE subscription instead of surfacing subscriptionsService.cancel's ACTIVE-only rejection", async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        userId: 'user1',
        provider: PaymentProvider.PAYPAL,
        providerSubscriptionId: 'I-AGREEMENT',
        status: 'PAST_DUE',
      });
      subscriptionsService.cancel.mockResolvedValue({ id: 'sub1', cancelAtPeriodEnd: true });

      await service.cancel('sub1', 'user1');

      expect(paypalService.cancelSubscription).toHaveBeenCalledWith('I-AGREEMENT');
      expect(subscriptionsService.cancel).toHaveBeenCalledWith('sub1', 'user1');
    });
  });
});
