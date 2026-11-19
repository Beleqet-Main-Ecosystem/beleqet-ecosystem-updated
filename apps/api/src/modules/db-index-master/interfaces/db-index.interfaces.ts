/**
 * @file db-index.interfaces.ts
 * @description Shared TypeScript interfaces for the DB Index Master module.
 */

/** Result returned by the EXPLAIN ANALYZE endpoint. */
export interface ExplainResult {
  /** Sanitised SQL (PII literals replaced with [REDACTED]). */
  sql: string;
  /** Raw EXPLAIN JSON plan from PostgreSQL. */
  plan: Record<string, unknown>;
  /** Human-readable highlights derived from the plan. */
  summary: {
    topNodeType: string;
    estimatedTotalCost: number;
    actualExecutionMs: number;
    estimatedRows: number;
    usesSeqScan: boolean;
    usesIndexScan: boolean;
    warnings: string[];
    indexSuggestion?: string;
  };
  /** ISO timestamp of the analysis. */
  analysedAt: string;
}

/** One row from pg_stat_user_indexes. */
export interface IndexUsageStat {
  schema: string;
  table: string;
  index: string;
  /** Number of index scans. */
  scans: number | bigint;
  tuplesRead: number | bigint;
  tuplesFetched: number | bigint;
  /** Human-readable size string (e.g. "1024 kB"). */
  sizeHuman: string;
  sizeBytes: number | bigint;
}

/** One row from pg_stat_user_tables filtered on seq_scan. */
export interface TableScanStat {
  table: string;
  seqScans: number | bigint;
  seqTuplesRead: number | bigint;
  idxScans: number | bigint;
  liveRows: number | bigint;
  /** Percentage of index vs total scans. */
  idxHitPercent: number;
}

/** An automatically-generated index suggestion for a table. */
export interface IndexSuggestion {
  table: string;
  reason: string;
  recommendation: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

/** Aggregated analysis report from the full-report endpoint. */
export interface AnalysisReport {
  generatedAt: string;
  totalIndexes: number;
  unusedIndexCount: number;
  unusedIndexes: IndexUsageStat[];
  heavySeqScanTables: TableScanStat[];
  suggestions: IndexSuggestion[];
  totalIndexSizeHuman: string;
}
