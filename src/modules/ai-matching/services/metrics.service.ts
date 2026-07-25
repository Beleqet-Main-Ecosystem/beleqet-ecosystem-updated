import { Injectable } from '@nestjs/common';
import { TokenUsageService } from './token-usage.service';

interface LatencyBreakdown {
  readonly embeddingMs: number;
  readonly vectorSearchMs: number;
  readonly llmEvaluationMs: number;
}

interface AiMatchingMetricsSnapshot {
  readonly totalMatches: number;
  readonly successRate: number;
  readonly fallbackRate: number;
  readonly averageLatencyMs: number;
  readonly latencyBreakdown: LatencyBreakdown;
}

interface PipelineEntry {
  readonly embeddingMs: number;
  readonly vectorSearchMs: number;
  readonly llmEvaluationMs: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly matchCount: number;
  readonly isFallback: boolean;
  readonly isSuccess: boolean;
}

const MAX_ENTRIES = 1000;

@Injectable()
export class MetricsService {
  private readonly entries: PipelineEntry[] = [];

  constructor(private readonly tokenUsageService: TokenUsageService) {}

  recordPipelineRun(entry: PipelineEntry): void {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.shift();
    }

    this.tokenUsageService.recordUsage(
      entry.promptTokens,
      entry.completionTokens,
      entry.totalTokens,
      entry.matchCount,
    );
  }

  getMetrics(): AiMatchingMetricsSnapshot {
    const total = this.entries.length;
    if (total === 0) {
      return {
        totalMatches: 0,
        successRate: 100,
        fallbackRate: 0,
        averageLatencyMs: 0,
        latencyBreakdown: { embeddingMs: 0, vectorSearchMs: 0, llmEvaluationMs: 0 },
      };
    }

    const successes = this.entries.filter((e) => e.isSuccess).length;
    const fallbacks = this.entries.filter((e) => e.isFallback).length;
    const totalMatchCount = this.entries.reduce((s, e) => s + e.matchCount, 0);

    const sumEmbedding = this.entries.reduce((s, e) => s + e.embeddingMs, 0);
    const sumVectorSearch = this.entries.reduce((s, e) => s + e.vectorSearchMs, 0);
    const sumLlmEval = this.entries.reduce((s, e) => s + e.llmEvaluationMs, 0);
    const totalLatency = sumEmbedding + sumVectorSearch + sumLlmEval;

    return {
      totalMatches: totalMatchCount,
      successRate: Math.round((successes / total) * 1000) / 10,
      fallbackRate: Math.round((fallbacks / total) * 1000) / 10,
      averageLatencyMs: Math.round(totalLatency / total),
      latencyBreakdown: {
        embeddingMs: Math.round(sumEmbedding / total),
        vectorSearchMs: Math.round(sumVectorSearch / total),
        llmEvaluationMs: Math.round(sumLlmEval / total),
      },
    };
  }
}
