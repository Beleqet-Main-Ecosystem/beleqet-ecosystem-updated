export interface FraudAlert {
  id: string;
  entityType: string;
  entityId: string;
  userId: string | null;
  ruleId: string | null;
  ruleType: 'OFF_PLATFORM_PAYMENT' | 'FAKE_PROFILE' | 'PAYMENT_ANOMALY' | 'DUPLICATE_LISTING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  score: number;
  reason: string;
  evidence: Record<string, unknown> | null;
  currency: string | null;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'FALSE_POSITIVE' | 'CONFIRMED';
  resolvedById: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; email: string; firstName: string; lastName: string } | null;
  resolvedBy?: { id: string; email: string; firstName: string; lastName: string } | null;
  rule?: { id: string; name: string; ruleType: string } | null;
}

export interface FraudRule {
  id: string;
  name: string;
  ruleType: string;
  severity: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  i18nKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
