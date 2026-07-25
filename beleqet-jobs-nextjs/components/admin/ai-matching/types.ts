export interface LatencyBreakdown {
  readonly embeddingMs: number;
  readonly vectorSearchMs: number;
  readonly llmEvaluationMs: number;
}

export interface TokenUsageDetail {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly estimatedCostUsd: number;
  readonly matchCount: number;
}

export interface DailyUsage extends TokenUsageDetail {
  readonly date: string;
}

export interface TokenUsage {
  readonly total: TokenUsageDetail;
  readonly today: TokenUsageDetail;
  readonly thisWeek: TokenUsageDetail;
  readonly thisMonth: TokenUsageDetail;
  readonly thisYear: TokenUsageDetail;
  readonly dailyHistory: readonly DailyUsage[];
}

export interface AiMatchingMetrics {
  readonly totalMatches: number;
  readonly successRate: number;
  readonly fallbackRate: number;
  readonly averageLatencyMs: number;
  readonly latencyBreakdown: LatencyBreakdown;
  readonly tokenUsage: TokenUsage;
}

export interface GdprAuditEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly freelancerId: string;
  readonly sessionToken: string;
  readonly piiDetected: boolean;
  readonly piiCategories: readonly string[];
  readonly fieldsRedacted: readonly string[];
  readonly confirmedPiiFree: boolean;
}
