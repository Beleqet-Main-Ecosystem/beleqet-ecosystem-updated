export interface ExplainResult {
    sql: string;
    plan: Record<string, unknown>;
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
    analysedAt: string;
}
export interface IndexUsageStat {
    schema: string;
    table: string;
    index: string;
    scans: number | bigint;
    tuplesRead: number | bigint;
    tuplesFetched: number | bigint;
    sizeHuman: string;
    sizeBytes: number | bigint;
}
export interface TableScanStat {
    table: string;
    seqScans: number | bigint;
    seqTuplesRead: number | bigint;
    idxScans: number | bigint;
    liveRows: number | bigint;
    idxHitPercent: number;
}
export interface IndexSuggestion {
    table: string;
    reason: string;
    recommendation: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
}
export interface AnalysisReport {
    generatedAt: string;
    totalIndexes: number;
    unusedIndexCount: number;
    unusedIndexes: IndexUsageStat[];
    heavySeqScanTables: TableScanStat[];
    suggestions: IndexSuggestion[];
    totalIndexSizeHuman: string;
}
