import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentGatewayService } from './payment-gateway.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

const mockPrismaService: any = {
  subscriptionPlan: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  subscription: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  subscriptionInvoice: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  job: {
    count: jest.fn(),
  },
  $transaction: jest.fn((cb: any) => {
    if (typeof cb === 'function') return cb(mockPrismaService);
    return cb;
  }),
};

const mockPaymentGatewayService = {
  initializeChapaTransaction: jest.fn(),
  createStripeCheckoutSession: jest.fn(),
};

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PaymentGatewayService, useValue: mockPaymentGatewayService },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getPlans', () => {
    it('should translate names and descriptions according to language', async () => {
      mockPrismaService.subscriptionPlan.findMany.mockResolvedValue([
        {
          id: 'plan-1',
          slug: 'pro',
          name: { en: 'Pro Plan', am: 'ፕሮ ዕቅድ' },
          description: { en: 'Pro Desc', am: 'ፕሮ መግለጫ' },
          isActive: true,
          prices: [],
        },
      ]);

      const result = await service.getPlans('am');
      expect(result[0].name).toBe('ፕሮ ዕቅድ');
      expect(result[0].description).toBe('ፕሮ መግለጫ');

      const resultEn = await service.getPlans('en');
      expect(resultEn[0].name).toBe('Pro Plan');
    });
  });

  describe('getUserSubscription', () => {
    it('should return active subscription if exists', async () => {
      const mockSub = { id: 'sub-1', userId: 'user-1', status: 'ACTIVE', plan: { slug: 'pro' } };
      mockPrismaService.subscription.findUnique.mockResolvedValue(mockSub);

      const result = await service.getUserSubscription('user-1');
      expect(result).toEqual(mockSub);
    });

    it('should fallback to free plan if none exists in db', async () => {
      mockPrismaService.subscription.findUnique.mockResolvedValue(null);
      mockPrismaService.subscriptionPlan.findUnique.mockResolvedValue({
        slug: 'free',
        limits: { maxJobs: 2 },
      });

      const result = await service.getUserSubscription('user-1');
      expect(result.status).toBe('INACTIVE');
      expect(result.plan.slug).toBe('free');
    });
  });

  describe('checkUserLimit', () => {
    it('should throw ForbiddenException if user has reached maxJobs limit', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        company: { id: 'company-1' },
      });

      mockPrismaService.subscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        plan: {
          slug: 'free',
          limits: { maxJobs: 2 },
        },
      });

      mockPrismaService.job.count.mockResolvedValue(2);

      await expect(service.checkUserLimit('user-1', 'maxJobs')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should resolve successfully if user is under maxJobs limit', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        company: { id: 'company-1' },
      });

      mockPrismaService.subscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        plan: {
          slug: 'free',
          limits: { maxJobs: 2 },
        },
      });

      mockPrismaService.job.count.mockResolvedValue(1);

      await expect(service.checkUserLimit('user-1', 'maxJobs')).resolves.not.toThrow();
    });
  });

  describe('subscribe (Proration Logic)', () => {
    it('should calculate proration correctly and charge 0 if remaining credit exceeds target cost', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@beleqet.com',
        firstName: 'Neba',
        lastName: 'T',
      });

      const planId = 'plan-pro';
      const priceId = 'price-pro-monthly';
      const currency = 'ETB';

      mockPrismaService.subscriptionPlan.findUnique.mockResolvedValue({
        id: planId,
        slug: 'pro',
        name: { en: 'Pro' },
        prices: [{ id: priceId, currency, amount: 10000, interval: 'MONTHLY' }],
      });

      // Active sub with 50% time remaining. Paid 30000 ETB originally.
      const currentPeriodStart = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      const currentPeriodEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      mockPrismaService.subscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        amount: 30000, // originally paid 300 ETB
        currency,
        currentPeriodStart,
        currentPeriodEnd,
        price: { id: 'old-price-id' },
      });

      mockPrismaService.subscription.upsert.mockResolvedValue({ id: 'sub-new' });
      mockPrismaService.subscriptionInvoice.create.mockResolvedValue({ id: 'inv-new', status: 'PAID' });

      // Target cost is 10000 (100 ETB). Proration credit = 50% of 20000 = 10000.
      // Net amount due = 10000 - 10000 = 0.
      const result = await service.subscribe('user-1', { planId, priceId, currency });
      expect(result.status).toBe('ACTIVE');
      expect(result.checkoutUrl).toBeNull();
    });
  });
});
