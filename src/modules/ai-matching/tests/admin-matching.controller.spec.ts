import { Test, type TestingModule } from '@nestjs/testing';
import { SanitizerService } from '../services/sanitizer.service';
import { MetricsService } from '../services/metrics.service';
import { TokenUsageService } from '../services/token-usage.service';
import { AdminMatchingController } from '../controllers/admin-matching.controller';

describe('AdminMatchingController', () => {
  let controller: AdminMatchingController;
  let metricsService: jest.Mocked<MetricsService>;
  let tokenUsageService: jest.Mocked<TokenUsageService>;
  let sanitizerService: { getAuditLog: jest.Mock };

  beforeEach(async () => {
    metricsService = {
      getMetrics: jest.fn(),
      recordPipelineRun: jest.fn(),
    } as unknown as jest.Mocked<MetricsService>;

    tokenUsageService = {
      getSummary: jest.fn(),
      getDailyHistory: jest.fn(),
      recordUsage: jest.fn(),
    } as unknown as jest.Mocked<TokenUsageService>;

    sanitizerService = {
      getAuditLog: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminMatchingController],
      providers: [
        { provide: SanitizerService, useValue: sanitizerService },
        { provide: MetricsService, useValue: metricsService },
        { provide: TokenUsageService, useValue: tokenUsageService },
      ],
    }).compile();

    controller = module.get<AdminMatchingController>(AdminMatchingController);
  });

  describe('getMetrics', () => {
    it('should merge MetricsService and TokenUsageService results', async () => {
      const mockMetrics = {
        totalMatches: 42,
        successRate: 85.5,
        fallbackRate: 3.2,
        averageLatencyMs: 1200,
        latencyBreakdown: { embeddingMs: 400, vectorSearchMs: 300, llmEvaluationMs: 500 },
      };
      const mockUsage = {
        total: {
          promptTokens: 20000,
          completionTokens: 8000,
          totalTokens: 28000,
          estimatedCostUsd: 4.2,
          matchCount: 42,
        },
        today: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCostUsd: 0.02,
          matchCount: 1,
        },
        thisWeek: {
          promptTokens: 500,
          completionTokens: 200,
          totalTokens: 700,
          estimatedCostUsd: 0.1,
          matchCount: 5,
        },
        thisMonth: {
          promptTokens: 5000,
          completionTokens: 2000,
          totalTokens: 7000,
          estimatedCostUsd: 1.0,
          matchCount: 20,
        },
        thisYear: {
          promptTokens: 20000,
          completionTokens: 8000,
          totalTokens: 28000,
          estimatedCostUsd: 4.2,
          matchCount: 42,
        },
        dailyHistory: [],
      };

      metricsService.getMetrics.mockReturnValue(mockMetrics);
      tokenUsageService.getSummary.mockResolvedValue(mockUsage);

      const result = await controller.getMetrics();

      expect(metricsService.getMetrics).toHaveBeenCalled();
      expect(tokenUsageService.getSummary).toHaveBeenCalled();
      expect(result.totalMatches).toBe(42);
      expect(result.tokenUsage).toEqual(mockUsage);
    });

    it('should return zeroed metrics when both services have no data', async () => {
      metricsService.getMetrics.mockReturnValue({
        totalMatches: 0,
        successRate: 100,
        fallbackRate: 0,
        averageLatencyMs: 0,
        latencyBreakdown: { embeddingMs: 0, vectorSearchMs: 0, llmEvaluationMs: 0 },
      });
      tokenUsageService.getSummary.mockResolvedValue({
        total: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
          matchCount: 0,
        },
        today: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
          matchCount: 0,
        },
        thisWeek: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
          matchCount: 0,
        },
        thisMonth: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
          matchCount: 0,
        },
        thisYear: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          estimatedCostUsd: 0,
          matchCount: 0,
        },
        dailyHistory: [],
      });

      const result = await controller.getMetrics();

      expect(result.totalMatches).toBe(0);
      expect(result.successRate).toBe(100);
      expect(result.averageLatencyMs).toBe(0);
    });
  });

  describe('getGdprAuditLog', () => {
    it('should return mapped audit log entries', async () => {
      sanitizerService.getAuditLog.mockReturnValue([
        {
          freelancerId: 'fl_1',
          sessionToken: 'tok_1',
          timestamp: new Date('2026-07-19T12:00:00Z'),
          piiDetected: true,
          piiCategories: ['email'],
          fieldsRedacted: ['bio'],
          confirmedPiiFree: false,
        },
        {
          freelancerId: 'fl_2',
          sessionToken: 'tok_2',
          timestamp: new Date('2026-07-19T13:00:00Z'),
          piiDetected: false,
          piiCategories: [],
          fieldsRedacted: [],
          confirmedPiiFree: true,
        },
      ]);

      const result = await controller.getGdprAuditLog();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('aud-001');
      expect(result[0].freelancerId).toBe('fl_1');
      expect(result[0].piiDetected).toBe(true);
      expect(result[0].piiCategories).toEqual(['email']);
      expect(result[0].confirmedPiiFree).toBe(false);
    });

    it('should return an empty array when audit log is empty', async () => {
      sanitizerService.getAuditLog.mockReturnValue([]);

      const result = await controller.getGdprAuditLog();

      expect(result).toEqual([]);
    });

    it('should format timestamp as ISO string', async () => {
      const date = new Date('2026-07-19T12:00:00Z');
      sanitizerService.getAuditLog.mockReturnValue([
        {
          freelancerId: 'fl_1',
          sessionToken: 'tok_1',
          timestamp: date,
          piiDetected: false,
          piiCategories: [],
          fieldsRedacted: [],
          confirmedPiiFree: true,
        },
      ]);

      const result = await controller.getGdprAuditLog();

      expect(result[0].timestamp).toBe(date.toISOString());
    });
  });
});
