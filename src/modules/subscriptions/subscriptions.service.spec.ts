import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: {
    plan: { findUnique: jest.Mock };
    subscription: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    webhookEvent: { create: jest.Mock };
    subscriptionTransaction: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      plan: { findUnique: jest.fn() },
      subscription: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      webhookEvent: { create: jest.fn() },
      subscriptionTransaction: { create: jest.fn() },
      $transaction: jest.fn(async (cb) =>
        cb({
          subscription: { update: prisma.subscription.update },
          subscriptionTransaction: { create: prisma.subscriptionTransaction.create },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SubscriptionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  describe('createPendingCheckout', () => {
    it('creates a PENDING subscription linked to the gateway id', async () => {
      prisma.plan.findUnique.mockResolvedValue({ id: 'plan1', interval: 'MONTHLY' });
      prisma.subscription.create.mockResolvedValue({ id: 'sub1' });

      await service.createPendingCheckout({
        userId: 'user1',
        planId: 'plan1',
        provider: 'PAYPAL',
        providerSubscriptionId: 'I-AGREEMENT',
      });

      expect(prisma.subscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: SubscriptionStatus.PENDING,
            providerSubscriptionId: 'I-AGREEMENT',
          }),
        }),
      );
    });

    it('throws NotFoundException when the plan does not exist', async () => {
      prisma.plan.findUnique.mockResolvedValue(null);
      await expect(
        service.createPendingCheckout({
          userId: 'user1',
          planId: 'missing',
          provider: 'PAYPAL',
          providerSubscriptionId: 'I-AGREEMENT',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assertNoActiveSubscription', () => {
    it('passes when the user has no active/pending subscription', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);
      await expect(service.assertNoActiveSubscription('user1')).resolves.toBeUndefined();
    });

    it('throws ConflictException when one already exists', async () => {
      prisma.subscription.findFirst.mockResolvedValue({ id: 'sub1' });
      await expect(service.assertNoActiveSubscription('user1')).rejects.toThrow(ConflictException);
    });
  });

  describe('cancel', () => {
    it('sets cancelAtPeriodEnd on an active subscription owned by the caller', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        userId: 'user1',
        status: SubscriptionStatus.ACTIVE,
      });
      prisma.subscription.update.mockResolvedValue({ id: 'sub1', cancelAtPeriodEnd: true });

      await service.cancel('sub1', 'user1');

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub1' },
        data: { cancelAtPeriodEnd: true },
      });
    });

    it('throws NotFoundException when the subscription belongs to another user', async () => {
      prisma.subscription.findUnique.mockResolvedValue({ id: 'sub1', userId: 'someone-else' });
      await expect(service.cancel('sub1', 'user1')).rejects.toThrow(NotFoundException);
    });

    it('sets cancelAtPeriodEnd on a PAST_DUE subscription owned by the caller', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        userId: 'user1',
        status: SubscriptionStatus.PAST_DUE,
      });
      prisma.subscription.update.mockResolvedValue({ id: 'sub1', cancelAtPeriodEnd: true });

      await service.cancel('sub1', 'user1');

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub1' },
        data: { cancelAtPeriodEnd: true },
      });
    });

    it('throws BadRequestException when the subscription is neither ACTIVE nor PAST_DUE', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        userId: 'user1',
        status: SubscriptionStatus.CANCELLED,
      });
      await expect(service.cancel('sub1', 'user1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('syncFromProviderEvent', () => {
    const baseInput = {
      gatewayEventId: 'evt-1',
      provider: 'PAYPAL' as const,
      eventType: 'ACTIVATED' as const,
      providerSubscriptionId: 'I-AGREEMENT',
    };

    it('is idempotent — a duplicate gatewayEventId is skipped without touching the subscription', async () => {
      prisma.webhookEvent.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );

      await service.syncFromProviderEvent(baseInput);

      expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('activates the subscription and computes the new period end from the plan interval', async () => {
      prisma.webhookEvent.create.mockResolvedValue({});
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        plan: { interval: 'MONTHLY' },
      });

      await service.syncFromProviderEvent({
        ...baseInput,
        amount: 9900,
        currency: 'ETB',
        gatewayReference: 'sale-1',
      });

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub1' },
          data: expect.objectContaining({ status: SubscriptionStatus.ACTIVE }),
        }),
      );
      expect(prisma.subscriptionTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriptionId: 'sub1',
            amount: 9900,
            currency: 'ETB',
            status: 'SUCCEEDED',
          }),
        }),
      );
    });

    it('does nothing (but does not throw) when no local subscription matches the provider id', async () => {
      prisma.webhookEvent.create.mockResolvedValue({});
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(service.syncFromProviderEvent(baseInput)).resolves.toBeUndefined();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('marks the subscription EXPIRED on an EXPIRED gateway event, without a ledger entry', async () => {
      prisma.webhookEvent.create.mockResolvedValue({});
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        plan: { interval: 'MONTHLY' },
      });

      await service.syncFromProviderEvent({ ...baseInput, eventType: 'EXPIRED' });

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: SubscriptionStatus.EXPIRED } }),
      );
      expect(prisma.subscriptionTransaction.create).not.toHaveBeenCalled();
    });

    it('marks the subscription CANCELLED on a CANCELLED event when the user never scheduled a cancel-at-period-end', async () => {
      prisma.webhookEvent.create.mockResolvedValue({});
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        cancelAtPeriodEnd: false,
        plan: { interval: 'MONTHLY' },
      });

      await service.syncFromProviderEvent({ ...baseInput, eventType: 'CANCELLED' });

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: SubscriptionStatus.CANCELLED } }),
      );
    });

    it('does NOT revoke access on a CANCELLED event when the user already scheduled cancel-at-period-end', async () => {
      prisma.webhookEvent.create.mockResolvedValue({});
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        cancelAtPeriodEnd: true,
        plan: { interval: 'MONTHLY' },
      });

      await service.syncFromProviderEvent({ ...baseInput, eventType: 'CANCELLED' });

      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  describe('sweepExpired', () => {
    it('marks overdue ACTIVE subscriptions EXPIRED and returns them for notification', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { id: 'sub1', userId: 'user1', cancelAtPeriodEnd: false, plan: { name: 'Pro' } },
      ]);
      prisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.sweepExpired(new Date('2026-07-21'));

      expect(prisma.subscription.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
          currentPeriodEnd: { lt: new Date('2026-07-21') },
        },
        select: expect.any(Object),
      });
      expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['sub1'] } },
        data: { status: SubscriptionStatus.EXPIRED },
      });
      expect(result).toEqual([{ id: 'sub1', userId: 'user1', planName: 'Pro' }]);
    });

    it('also sweeps overdue PAST_DUE subscriptions, not just ACTIVE ones', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { id: 'sub1', userId: 'user1', cancelAtPeriodEnd: false, plan: { name: 'Pro' } },
      ]);
      prisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.sweepExpired(new Date('2026-07-21'));

      expect(prisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
          }),
        }),
      );
      expect(result).toEqual([{ id: 'sub1', userId: 'user1', planName: 'Pro' }]);
    });

    it('marks an overdue subscription CANCELLED instead of EXPIRED when the user already scheduled cancel-at-period-end', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { id: 'sub1', userId: 'user1', cancelAtPeriodEnd: true, plan: { name: 'Pro' } },
      ]);
      prisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      await service.sweepExpired(new Date('2026-07-21'));

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['sub1'] } },
        data: { status: SubscriptionStatus.CANCELLED },
      });
      expect(prisma.subscription.updateMany).toHaveBeenCalledTimes(1);
    });

    it('splits a mixed batch into one CANCELLED update and one EXPIRED update', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        { id: 'sub1', userId: 'user1', cancelAtPeriodEnd: true, plan: { name: 'Pro' } },
        { id: 'sub2', userId: 'user2', cancelAtPeriodEnd: false, plan: { name: 'Enterprise' } },
      ]);
      prisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.sweepExpired(new Date('2026-07-21'));

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['sub1'] } },
        data: { status: SubscriptionStatus.CANCELLED },
      });
      expect(prisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['sub2'] } },
        data: { status: SubscriptionStatus.EXPIRED },
      });
      expect(result).toEqual([
        { id: 'sub1', userId: 'user1', planName: 'Pro' },
        { id: 'sub2', userId: 'user2', planName: 'Enterprise' },
      ]);
    });

    it('is a no-op when nothing is overdue', async () => {
      prisma.subscription.findMany.mockResolvedValue([]);
      const result = await service.sweepExpired();
      expect(result).toEqual([]);
      expect(prisma.subscription.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('findAndMarkDueForReminder', () => {
    it('marks reminded subscriptions so the next run does not re-notify', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        {
          id: 'sub1',
          userId: 'user1',
          currentPeriodEnd: new Date('2026-07-24'),
          plan: { name: 'Pro' },
        },
      ]);
      prisma.subscription.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.findAndMarkDueForReminder(3, new Date('2026-07-21'));

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { in: ['sub1'] } } }),
      );
      expect(result).toEqual([
        { id: 'sub1', userId: 'user1', planName: 'Pro', currentPeriodEnd: new Date('2026-07-24') },
      ]);
    });
  });
});
