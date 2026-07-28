import { PrismaService } from '../../prisma/prisma.service';
import { ExplainResult, IndexUsageStat, TableScanStat, AnalysisReport } from './interfaces/db-index.interfaces';
export declare class DbIndexMasterService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    explainQuery(sql: string, _params?: unknown[]): Promise<ExplainResult>;
    listIndexes(): Promise<IndexUsageStat[]>;
    unusedIndexes(): Promise<IndexUsageStat[]>;
    heavySeqScanTables(): Promise<TableScanStat[]>;
    fullReport(): Promise<AnalysisReport>;
    private validateQuerySql;
    private sanitiseSqlForLog;
    private buildPlanSummary;
    private treeContains;
    private suggestIndexTypeFromPlan;
    private generateSuggestions;
    private bytesToHuman;
}
