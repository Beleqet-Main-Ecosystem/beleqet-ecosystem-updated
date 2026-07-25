import { MetricsService } from '../services/metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;
  let tokenUsageService: { recordUsage: jest.Mock };

  beforeEach(() => {
    tokenUsageService = { recordUsage: jest.fn().mockResolvedValue(undefined) };
    service = new MetricsService(tokenUsageService as any);
  });

  describe('getMetrics (empty state)', () => {
    it('should return 100% success rate when no entries exist', () => {
      const metrics = service.getMetrics();

      expect(metrics.successRate).toBe(100);
      expect(metrics.fallbackRate).toBe(0);
      expect(metrics.totalMatches).toBe(0);
      expect(metrics.averageLatencyMs).toBe(0);
    });
  });

  describe('recordPipelineRun + getMetrics', () => {
    it('should accumulate totalMatches across all runs', () => {
      service.recordPipelineRun({
        embeddingMs: 100,
        vectorSearchMs: 50,
        llmEvaluationMs: 200,
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        matchCount: 3,
        isFallback: false,
        isSuccess: true,
      });
      service.recordPipelineRun({
        embeddingMs: 200,
        vectorSearchMs: 100,
        llmEvaluationMs: 300,
        promptTokens: 20,
        completionTokens: 10,
        totalTokens: 30,
        matchCount: 5,
        isFallback: false,
        isSuccess: true,
      });

      const metrics = service.getMetrics();

      expect(metrics.totalMatches).toBe(8);
    });

    it('should compute correct average latency', () => {
      service.recordPipelineRun({
        embeddingMs: 100,
        vectorSearchMs: 50,
        llmEvaluationMs: 50,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        matchCount: 0,
        isFallback: false,
        isSuccess: true,
      });
      service.recordPipelineRun({
        embeddingMs: 200,
        vectorSearchMs: 100,
        llmEvaluationMs: 100,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        matchCount: 0,
        isFallback: false,
        isSuccess: true,
      });

      const metrics = service.getMetrics();

      expect(metrics.averageLatencyMs).toBe(300);
      expect(metrics.latencyBreakdown.embeddingMs).toBe(150);
      expect(metrics.latencyBreakdown.vectorSearchMs).toBe(75);
      expect(metrics.latencyBreakdown.llmEvaluationMs).toBe(75);
    });

    it('should compute success and fallback rates', () => {
      service.recordPipelineRun({
        embeddingMs: 0,
        vectorSearchMs: 0,
        llmEvaluationMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        matchCount: 0,
        isFallback: false,
        isSuccess: true,
      });
      service.recordPipelineRun({
        embeddingMs: 0,
        vectorSearchMs: 0,
        llmEvaluationMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        matchCount: 0,
        isFallback: true,
        isSuccess: true,
      });
      service.recordPipelineRun({
        embeddingMs: 0,
        vectorSearchMs: 0,
        llmEvaluationMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        matchCount: 0,
        isFallback: false,
        isSuccess: false,
      });

      const metrics = service.getMetrics();

      expect(metrics.successRate).toBe(66.7);
      expect(metrics.fallbackRate).toBe(33.3);
    });

    it('should delegate token persistence to TokenUsageService', () => {
      service.recordPipelineRun({
        embeddingMs: 0,
        vectorSearchMs: 0,
        llmEvaluationMs: 0,
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        matchCount: 2,
        isFallback: false,
        isSuccess: true,
      });

      expect(tokenUsageService.recordUsage).toHaveBeenCalledWith(100, 50, 150, 2);
    });

    it('should keep a maximum of 1000 entries', () => {
      for (let i = 0; i < 1500; i++) {
        service.recordPipelineRun({
          embeddingMs: i,
          vectorSearchMs: 0,
          llmEvaluationMs: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          matchCount: 1,
          isFallback: false,
          isSuccess: true,
        });
      }

      const metrics = service.getMetrics();

      expect(metrics.totalMatches).toBe(1000);
      expect(metrics.averageLatencyMs).toBeGreaterThan(500);
    });
  });
});
