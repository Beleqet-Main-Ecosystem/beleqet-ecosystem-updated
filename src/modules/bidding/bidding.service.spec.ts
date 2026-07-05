import { Test, TestingModule } from '@nestjs/testing';
import { BiddingService } from './bidding.service';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { I18nContext } from 'nestjs-i18n';
import { BiddingPricingHelper } from './helpers/bidding-pricing.helper';

describe('BiddingService', () => {
  let service: BiddingService;

  const mockPrisma = {
    bidSuggestion: { create: jest.fn() },
  };

  const mockPricingHelper = { calculate: jest.fn() };

  const mockI18n = {
    translate: jest.fn((key: string) => {
      if (key === 'bidding.rationale.coldStart') {
        return Promise.resolve(
          'No pricing history yet for this category — suggestion is based on the job budget only.',
        );
      }
      if (key === 'bidding.rationale.marketBased') {
        return Promise.resolve('Based on market history and experience.');
      }
      return Promise.resolve('');
    }),
  };

  beforeEach(async () => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ lang: 'en' } as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiddingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: BiddingPricingHelper, useValue: mockPricingHelper },
      ],
    }).compile();

    service = module.get<BiddingService>(BiddingService);
    jest.clearAllMocks();
  });

  it('handles cold-start suggestions', async () => {
    mockPricingHelper.calculate.mockResolvedValue({
      job: { budgetMin: 5000, budgetMax: 9000, currency: 'ETB', categoryId: 'cat-new' },
      marketRate: null,
      marketCount: 0,
      experienceMultiplier: 0.9,
      suggestedPrice: 7000,
    });

    mockPrisma.bidSuggestion.create.mockResolvedValue({});

    const result = await service.suggestPrice('freelancer-456', 'job-456');

    expect(result.suggestedPrice).toBe(7000);
    expect(result.currency).toBe('ETB');
    expect(result.rationale).toContain('No pricing history');
    expect(mockPrisma.bidSuggestion.create).toHaveBeenCalled();
  });
});
