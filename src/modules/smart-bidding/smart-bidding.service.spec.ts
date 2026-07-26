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
      del: jest.fn(),
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
      redisMock.set.mockResolvedValue('OK');
      redisMock.del.mockResolvedValue(1);
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
      redisMock.set.mockResolvedValue('OK');
      redisMock.del.mockResolvedValue(1);
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
      redisMock.set.mockResolvedValue('OK');
      redisMock.del.mockResolvedValue(1);
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
      redisMock.set.mockResolvedValue('OK');
      redisMock.del.mockResolvedValue(1);
      prismaMock.freelanceJob.findUnique.mockResolvedValue(mockJob);

      // Fix 2 — contracts now filtered by contract.currency (not freelanceJob.currency).
      // Mock past completed contracts with average price = 1800.
      prismaMock.contract.findMany.mockResolvedValue([
        { agreedAmount: 1700 },
        { agreedAmount: 1900 },
      ]);

      const result = await service.predictBid('job-123');

      // Verify the contract query uses direct currency filter (not nested freelanceJob.currency)
      expect(prismaMock.contract.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            currency: mockJob.currency,         // direct field on Contract
            freelanceJob: expect.objectContaining({
              categoryId: mockJob.categoryId,   // category still via relation
            }),
          }),
        }),
      );

      // Base = 1800
      expect(result.recommendedBidAmount).toBe(1800);
      expect(result.confidenceScore).toBe(70); // 50 base + 20 historical data
    });
  });

  // ─── Fix 3: Cache Stampede — in-flight lock ───────────────────────────────
  describe('getJobComplexity — cache stampede prevention (Fix 3)', () => {
    const mockJob = {
      id: 'job-stampede',
      title: 'Test Job',
      description: 'Description',
      budgetMin: 500,
      budgetMax: 1000,
      currency: 'ETB',
      deadlineDays: 7,
      skills: [],
      categoryId: 'cat-1',
    };

    it('should return heuristic fallback without calling OpenAI when lock is already held', async () => {
      // Prediction cache miss
      redisMock.get.mockResolvedValueOnce(null); // predictBid full-prediction cache miss
      // Complexity cache miss (first get inside getJobComplexity)
      redisMock.get.mockResolvedValueOnce(null);
      // Lock NX returns null — lock is already held by another process
      redisMock.set.mockResolvedValueOnce(null);
      // All poll attempts return null (result never appears in cache within window)
      redisMock.get.mockResolvedValue(null);

      prismaMock.freelanceJob.findUnique.mockResolvedValue(mockJob);
      prismaMock.contract.findMany.mockResolvedValue([]);
      prismaMock.bid.findMany.mockResolvedValue([]);

      // Override setTimeout so polling resolves instantly in tests
      jest.useFakeTimers();

      const resultPromise = service.predictBid('job-stampede');
      // Fast-forward all timers to skip the polling delays
      await jest.runAllTimersAsync();
      const result = await resultPromise;

      jest.useRealTimers();

      // Should still return a valid heuristic-based prediction, not throw
      expect(result).toBeDefined();
      expect(result.aiModelUsed).toBe('none (fallback heuristic)');
      // The fallback should NOT have been written to the lock-owner's cache key
      // (only the lock-owner writes the complexity result)
      expect(redisMock.set).not.toHaveBeenCalledWith(
        `smart-bidding:complexity:job:${mockJob.id}`,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should poll cache and return cached result when in-flight request completes', async () => {
      const cachedComplexity = {
        complexityFactor: 1.1,
        estimatedTimelineDays: 10,
        explanationEn: 'Moderate',
        explanationAm: 'መካከለኛ',
        aiModelUsed: 'gpt-4o-mini',
        isAiProcessed: true,
      };

      // Prediction cache miss
      redisMock.get.mockResolvedValueOnce(null);
      // Complexity cache miss
      redisMock.get.mockResolvedValueOnce(null);
      // Lock NX returns null — lock held
      redisMock.set.mockResolvedValueOnce(null);
      // First poll: still null; second poll: cache is populated
      redisMock.get.mockResolvedValueOnce(null);
      redisMock.get.mockResolvedValueOnce(JSON.stringify(cachedComplexity));

      prismaMock.freelanceJob.findUnique.mockResolvedValue(mockJob);
      prismaMock.contract.findMany.mockResolvedValue([]);
      prismaMock.bid.findMany.mockResolvedValue([]);

      jest.useFakeTimers();
      const resultPromise = service.predictBid('job-stampede');
      await jest.runAllTimersAsync();
      const result = await resultPromise;
      jest.useRealTimers();

      expect(result.aiModelUsed).toBe('gpt-4o-mini');
    });
  });

  // ─── Fix 4: Fallback Caching TTL ─────────────────────────────────────────
  describe('getJobComplexity — fallback TTL (Fix 4)', () => {
    const mockJob = {
      id: 'job-ttl',
      title: 'TTL Test Job',
      description: 'Description',
      budgetMin: 500,
      budgetMax: 1000,
      currency: 'ETB',
      deadlineDays: 7,
      skills: [],
      categoryId: 'cat-1',
    };

    it('should cache a heuristic fallback with a short 300s TTL', async () => {
      // All cache misses; lock acquired (NX returns OK)
      redisMock.get.mockResolvedValue(null);
      redisMock.set.mockImplementation((...args: any[]) => {
        // Return OK for both NX lock set and the complexity cache set
        return Promise.resolve('OK');
      });
      redisMock.del.mockResolvedValue(1);

      prismaMock.freelanceJob.findUnique.mockResolvedValue(mockJob);
      prismaMock.contract.findMany.mockResolvedValue([]);
      prismaMock.bid.findMany.mockResolvedValue([]);

      // OpenAI is null (no API key), so result will be a heuristic fallback
      await service.predictBid('job-ttl');

      // Find the complexity cache write call
      const complexitySetCall = redisMock.set.mock.calls.find(
        (call: any[]) => call[0] === `smart-bidding:complexity:job:${mockJob.id}`,
      );

      expect(complexitySetCall).toBeDefined();
      // TTL argument (index 3) should be 300 for fallback
      expect(complexitySetCall[3]).toBe(300);
    });
  });
});
