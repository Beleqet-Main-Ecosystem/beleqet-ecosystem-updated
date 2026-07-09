import { Test, TestingModule } from '@nestjs/testing';
import { BiddingService } from './bidding.service';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { BiddingPricingHelper } from './helpers/bidding-pricing.helper';

/**
 * Integration test: verifies Smart Bidding works with multi-currency jobs
 * without errors, respecting the job's currency field.
 */
describe('BiddingService - Multi-Currency Integration', () => {
  let service: BiddingService;

  const mockPrisma = {
    freelanceJob: { findUnique: jest.fn() },
    contract: { aggregate: jest.fn(), count: jest.fn() },
    bidSuggestion: { upsert: jest.fn() },
  };

  const mockI18n = {
    translate: jest.fn((key: string) => Promise.resolve(`Translated: ${key}`)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiddingService,
        BiddingPricingHelper,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();

    service = module.get<BiddingService>(BiddingService);
    jest.clearAllMocks();
  });

  it('handles ETB currency correctly', async () => {
    mockPrisma.freelanceJob.findUnique.mockResolvedValue({
      budgetMin: 5000,
      budgetMax: 10000,
      currency: 'ETB',
      categoryId: 'cat-123',
    });

    mockPrisma.contract.aggregate.mockResolvedValue({
      _avg: { agreedAmount: 7500 },
      _count: 5,
    });

    mockPrisma.contract.count.mockResolvedValue(2);

    mockPrisma.bidSuggestion.upsert.mockResolvedValue({});

    const result = await service.suggestPrice('freelancer-123', 'job-eth');

    expect(result.currency).toBe('ETB');
    expect(result.suggestedPrice).toBeGreaterThanOrEqual(5000);
    expect(result.suggestedPrice).toBeLessThanOrEqual(10000);
    expect(mockPrisma.bidSuggestion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ currency: 'ETB' }),
        update: expect.objectContaining({ currency: 'ETB' }),
      }),
    );
  });

  it('handles USD currency correctly', async () => {
    mockPrisma.freelanceJob.findUnique.mockResolvedValue({
      budgetMin: 100,
      budgetMax: 300,
      currency: 'USD',
      categoryId: 'cat-456',
    });

    mockPrisma.contract.aggregate.mockResolvedValue({
      _avg: { agreedAmount: 200 },
      _count: 3,
    });

    mockPrisma.contract.count.mockResolvedValue(1);

    mockPrisma.bidSuggestion.upsert.mockResolvedValue({});

    const result = await service.suggestPrice('freelancer-456', 'job-usd');

    expect(result.currency).toBe('USD');
    expect(result.suggestedPrice).toBeGreaterThanOrEqual(100);
    expect(result.suggestedPrice).toBeLessThanOrEqual(300);
  });

  it('handles EUR currency correctly', async () => {
    mockPrisma.freelanceJob.findUnique.mockResolvedValue({
      budgetMin: 80,
      budgetMax: 250,
      currency: 'EUR',
      categoryId: 'cat-789',
    });

    mockPrisma.contract.aggregate.mockResolvedValue({
      _avg: { agreedAmount: null },
      _count: 0,
    });

    mockPrisma.contract.count.mockResolvedValue(0);

    mockPrisma.bidSuggestion.upsert.mockResolvedValue({});

    const result = await service.suggestPrice('freelancer-789', 'job-eur');

    expect(result.currency).toBe('EUR');
    expect(result.suggestedPrice).toBeGreaterThanOrEqual(80);
    expect(result.suggestedPrice).toBeLessThanOrEqual(250);
  });

  it('persists currency to database via upsert', async () => {
    mockPrisma.freelanceJob.findUnique.mockResolvedValue({
      budgetMin: 1000,
      budgetMax: 2000,
      currency: 'GBP',
      categoryId: 'cat-gbp',
    });

    mockPrisma.contract.aggregate.mockResolvedValue({
      _avg: { agreedAmount: 1500 },
      _count: 2,
    });

    mockPrisma.contract.count.mockResolvedValue(5);

    mockPrisma.bidSuggestion.upsert.mockResolvedValue({});

    await service.suggestPrice('freelancer-gbp', 'job-gbp');

    expect(mockPrisma.bidSuggestion.upsert).toHaveBeenCalledWith({
      where: {
        freelanceJobId_freelancerId: {
          freelanceJobId: 'job-gbp',
          freelancerId: 'freelancer-gbp',
        },
      },
      update: expect.objectContaining({ currency: 'GBP' }),
      create: expect.objectContaining({ currency: 'GBP' }),
    });
  });
});
