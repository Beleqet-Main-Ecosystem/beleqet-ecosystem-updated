import { PrismaService } from '../../prisma/prisma.service';
export interface ExecutionPlan {
    query: string;
    planRows: unknown[];
    totalCostEstimate: number | null;
    actualTimeMs: number | null;
    indexesUsed: string[];
    seqScans: string[];
    warnings: string[];
}
export declare class QueryMonitorService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    analyzeQuery(sql: string, params?: unknown[]): Promise<ExecutionPlan>;
    runHealthCheck(sessionId: string): Promise<void>;
    private parsePlan;
    private walkPlan;
}
