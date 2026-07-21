import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmartBiddingService } from './smart-bidding.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { NotFoundException } from '@nestjs/common';

describe('SmartBiddingService', () => {
  let service: SmartBiddingService;
  let prismaMock: any;
  let redisMock: any;
  let configMock: any;

  beforeEach(async () => {
    prismaMock = {
      freelanceJob: {
        findUnique: jest.fn(),
      },
      contract: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      bid: {
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    redisMock = {
      get: jest.fn(),
      set: jest.fn(),
    };

    configMock = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'OPENAI_API_KEY') return null; // No OpenAI API key by default to test fallback heuristics
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartBiddingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: REDIS_CLIENT, useValue: redisMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<SmartBiddingService>(SmartBiddingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('predictBid', () => {
    const mockJob = {
      id: 'job-123',
      title: 'Develop NestJS API',
      description: 'Need a developer to build APIs',
      budgetMin: 1000,
      budgetMax: 2000,
      currency: 'ETB',
      pricingType: 'FIXED',
      deadlineDays: 14,
      skills: ['NestJS', 'TypeScript'],
      categoryId: 'cat-999',
    };

    it('should throw NotFoundException if job does not exist', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.freelanceJob.findUnique.mockResolvedValue(null);

      await expect(service.predictBid('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should return cached prediction if available in Redis', async () => {
      const cachedResult = {
        recommendedBidAmount: 1500,
        minSuggestedBid: 1275,
        maxSuggestedBid: 1725,
        currency: 'ETB',
        confidenceScore: 80,
        estimatedTimelineDays: 14,
        breakdown: {
          marketBaseline: 1500,
          experienceAdjustment: 0,
          skillMatchAdjustment: 0,
          complexityAdjustment: 0,
          explanationEn: 'Cached prediction',
          explanationAm: 'የተቀመጠ ትንበያ',
        },
        aiModelUsed: 'none',
        cached: false,
      };

      redisMock.get.mockResolvedValue(JSON.stringify(cachedResult));

      const result = await service.predictBid('job-123', 'freelancer-456');

      expect(redisMock.get).toHaveBeenCalledWith(
        'smart-bidding:job:job-123:freelancer:freelancer-456',
      );
      expect(result).toBeDefined();
      expect(result.cached).toBe(true);
      expect(result.recommendedBidAmount).toBe(1500);
      expect(prismaMock.freelanceJob.findUnique).not.toHaveBeenCalled();
    });

    it('should calculate prediction with fallback heuristic when OpenAI is disabled (Generic case)', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.freelanceJob.findUnique.mockResolvedValue(mockJob);
      prismaMock.contract.findMany.mockResolvedValue([]);
      prismaMock.bid.findMany.mockResolvedValue([]);

      const result = await service.predictBid('job-123');

      // Midpoint: (1000 + 2000) / 2 = 1500
      // Complexity: 1.0 (fallback)
      // Seniority: 1.0 (generic)
      // Skills Match: 1.0 (generic)
      expect(result.recommendedBidAmount).toBe(1500);
      expect(result.minSuggestedBid).toBe(1275); // 1500 * 0.85
      expect(result.maxSuggestedBid).toBe(1725); // 1500 * 1.15
      expect(result.currency).toBe('ETB');
      expect(result.confidenceScore).toBe(50); // baseline (no historical, no user skills, no AI)
      expect(redisMock.set).toHaveBeenCalled();
    });

    it('should adjust price based on freelancer seniority (expert case)', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.freelanceJob.findUnique.mockResolvedValue(mockJob);
      prismaMock.contract.findMany.mockResolvedValue([]);
      prismaMock.bid.findMany.mockResolvedValue([]);

      // Senior freelancer mock
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'freelancer-senior',
        skills: ['NestJS', 'TypeScript'],
      });
      prismaMock.contract.count.mockResolvedValue(10); // >= 8 completed -> expert multiplier: 1.25

      const result = await service.predictBid('job-123', 'freelancer-senior');

      // Base midpoint: 1500
      // Seniority: 1.25
      // Skills match: 1.15 (100% matched skills: 0.9 + 1.0 * 0.25 = 1.15)
      // Expected = 1500 * 1.25 * 1.15 = 2156
      expect(result.recommendedBidAmount).toBe(2156);
      expect(result.breakdown.experienceAdjustment).toBe(0.25);
      expect(result.breakdown.skillMatchAdjustment).toBe(0.15);
      expect(result.confidenceScore).toBe(65); // 50 base + 15 skill match
    });

    it('should adjust price based on freelancer seniority (junior case)', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.freelanceJob.findUnique.mockResolvedValue(mockJob);
      prismaMock.contract.findMany.mockResolvedValue([]);
      prismaMock.bid.findMany.mockResolvedValue([]);

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'freelancer-junior',
        skills: ['TypeScript'], // 1 out of 2 matched
      });
      prismaMock.contract.count.mockResolvedValue(1); // < 3 completed -> junior multiplier: 0.85

      const result = await service.predictBid('job-123', 'freelancer-junior');

      // Base midpoint: 1500
      // Seniority: 0.85
      // Skills match: 1.025 (50% matched skills: 0.9 + 0.5 * 0.25 = 1.025)
      // Expected = 1500 * 0.85 * 1.025 = 1307
      expect(result.recommendedBidAmount).toBe(1307);
      expect(result.breakdown.experienceAdjustment).toBe(-0.15); // 0.85 - 1
      expect(result.breakdown.skillMatchAdjustment).toBe(0.02); // 1.025 - 1 = 0.025 (rounds to 0.02)
    });

    it('should utilize historical completed contract prices to establish baseline', async () => {
      redisMock.get.mockResolvedValue(null);
      prismaMock.freelanceJob.findUnique.mockResolvedValue(mockJob);

      // Mock past completed contracts with average price = 1800
      prismaMock.contract.findMany.mockResolvedValue([
        { agreedAmount: 1700 },
        { agreedAmount: 1900 },
      ]);

      const result = await service.predictBid('job-123');

      // Base = 1800
      expect(result.recommendedBidAmount).toBe(1800);
      expect(result.confidenceScore).toBe(70); // 50 base + 20 historical data
    });
  });
});
