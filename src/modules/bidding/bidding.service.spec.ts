import { Test, TestingModule } from '@nestjs/testing';
import { BiddingService } from './bidding.service';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { NotFoundException } from '@nestjs/common';

describe('BiddingService', () => {
  let service: BiddingService;

  const mockPrisma = {
    freelanceJob: { findUnique: jest.fn() },
    contract: { count: jest.fn(), findMany: jest.fn() },
  };

  const mockI18n = {
    translate: jest.fn((key: string, options?: { args?: Record<string, unknown> }) => {
      if (key === 'bidding.rationale.coldStart') {
        return Promise.resolve(
          `No market data available. Suggestion based on job budget midpoint with ${options?.args?.experienceMultiplier}x experience adjustment.`
        );
      }
      if (key === 'bidding.rationale.marketBased') {
        return Promise.resolve(
          `Based on market rate of ${options?.args?.marketRate} and ${options?.args?.experienceMultiplier}x experience multiplier.`
        );
      }
      return Promise.resolve('');
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiddingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();

    service = module.get<BiddingService>(BiddingService);

    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws NotFoundException when job does not exist', async () => {
    mockPrisma.freelanceJob.findUnique.mockResolvedValue(null);

    await expect(
      service.suggestPrice('freelancer-123', 'job-nonexistent')
    ).rejects.toThrow(NotFoundException);
  });

  it('suggests a price within the job stated budget range', async () => {
    // Arrange: job with budget 10000-20000 ETB
    mockPrisma.freelanceJob.findUnique.mockResolvedValue({
      budgetMin: 10000,
      budgetMax: 20000,
      currency: 'ETB',
      categoryId: 'cat-123',
    });

    // Freelancer has 0 completed contracts (0.9x multiplier)
    mockPrisma.contract.count.mockResolvedValue(0);

    // Market rate exists: 18000
    mockPrisma.contract.findMany.mockResolvedValue([
      { agreedAmount: 18000 },
      { agreedAmount: 16000 },
    ]);

    // Act
    const result = await service.suggestPrice('freelancer-123', 'job-123');

    // Assert
    expect(result.suggestedPrice).toBeGreaterThanOrEqual(10000);
    expect(result.suggestedPrice).toBeLessThanOrEqual(20000);
    expect(result.currency).toBe('ETB');
    expect(result.budgetMin).toBe(10000);
    expect(result.budgetMax).toBe(20000);
    expect(result.rationale).toContain('market rate');
  });

  it('uses cold-start fallback when no market data exists', async () => {
    // Arrange: job with no historical contracts in category
    mockPrisma.freelanceJob.findUnique.mockResolvedValue({
      budgetMin: 5000,
      budgetMax: 8000,
      currency: 'ETB',
      categoryId: 'cat-new',
    });

    mockPrisma.contract.count.mockResolvedValue(2); // 1.0x multiplier
    mockPrisma.contract.findMany.mockResolvedValue([]); // No market data

    // Act
    const result = await service.suggestPrice('freelancer-456', 'job-456');

    // Assert: should use midpoint (6500) * 1.0x = 6500
    expect(result.suggestedPrice).toBe(6500);
    expect(result.rationale).toContain('No market data');
    expect(result.rationale).toContain('1.00x');
  });

  it('applies experience multiplier correctly for novice freelancer', async () => {
    mockPrisma.freelanceJob.findUnique.mockResolvedValue({
      budgetMin: 10000,
      budgetMax: 10000, // Fixed budget
      currency: 'USD',
      categoryId: 'cat-123',
    });

    // Novice: 0 completed contracts → 0.9x
    mockPrisma.contract.count.mockResolvedValue(0);
    mockPrisma.contract.findMany.mockResolvedValue([]);

    // Act
    const result = await service.suggestPrice('freelancer-novice', 'job-789');

    // Assert: 10000 * 0.9 = 9000, but clamped to budgetMin 10000
    expect(result.suggestedPrice).toBe(10000);
    expect(result.currency).toBe('USD');
  });

  it('applies experience multiplier correctly for experienced freelancer', async () => {
    mockPrisma.freelanceJob.findUnique.mockResolvedValue({
      budgetMin: 5000,
      budgetMax: 15000,
      currency: 'ETB',
      categoryId: 'cat-123',
    });

    // Expert: 5+ completed contracts → 1.1x
    mockPrisma.contract.count.mockResolvedValue(7);
    mockPrisma.contract.findMany.mockResolvedValue([]);

    // Act
    const result = await service.suggestPrice('freelancer-expert', 'job-999');

    // Assert: midpoint 10000 * 1.1 = 11000
    expect(result.suggestedPrice).toBe(11000);
    expect(result.budgetMin).toBe(5000);
    expect(result.budgetMax).toBe(15000);
  });

  it('respects the job currency field', async () => {
    mockPrisma.freelanceJob.findUnique.mockResolvedValue({
      budgetMin: 1000,
      budgetMax: 2000,
      currency: 'USD',
      categoryId: 'cat-123',
    });

    mockPrisma.contract.count.mockResolvedValue(1);
    mockPrisma.contract.findMany.mockResolvedValue([{ agreedAmount: 1500 }]);

    const result = await service.suggestPrice('freelancer-123', 'job-usd');

    expect(result.currency).toBe('USD');
  });
});
