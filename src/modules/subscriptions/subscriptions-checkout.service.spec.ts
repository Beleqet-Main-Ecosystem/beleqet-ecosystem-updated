import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { SubscriptionsCheckoutService } from './subscriptions-checkout.service';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaypalService } from '../payments/paypal.service';

describe('SubscriptionsCheckoutService', () => {
  let service: SubscriptionsCheckoutService;
  let prisma: { plan: { findUnique: jest.Mock }; subscription: { findUnique: jest.Mock } };
  let paypalService: { createSubscription: jest.Mock; cancelSubscription: jest.Mock };
  let subscriptionsService: {
    assertNoActiveSubscription: jest.Mock;
    createPendingCheckout: jest.Mock;
    cancel: jest.Mock;
  };

  beforeEach(async () => {
    prisma = { plan: { findUnique: jest.fn() }, subscription: { findUnique: jest.fn() } };
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
      ],
    }).compile();

    service = module.get<SubscriptionsCheckoutService>(SubscriptionsCheckoutService);
  });

  describe('checkout', () => {
    it('creates a PayPal billing agreement and links a local PENDING subscription to it', async () => {
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

      const result = await service.checkout('user1', { planId: 'plan1' });

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
      expect(result).toEqual({
        subscription: { id: 'sub1' },
        approvalUrl: 'https://paypal.example/approve',
      });
    });

    it('throws NotFoundException for a missing or inactive plan', async () => {
      prisma.plan.findUnique.mockResolvedValue(null);
      await expect(service.checkout('user1', { planId: 'missing' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the plan has no paypalPlanId configured', async () => {
      prisma.plan.findUnique.mockResolvedValue({ id: 'plan1', isActive: true, paypalPlanId: null });
      await expect(service.checkout('user1', { planId: 'plan1' })).rejects.toThrow(
        BadRequestException,
      );
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
