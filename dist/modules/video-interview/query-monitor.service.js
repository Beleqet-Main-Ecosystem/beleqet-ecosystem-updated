"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var QueryMonitorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryMonitorService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let QueryMonitorService = QueryMonitorService_1 = class QueryMonitorService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(QueryMonitorService_1.name);
    }
    async analyzeQuery(sql, params = []) {
        const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
        const rows = await this.prisma.$queryRawUnsafe(explainSql, ...params);
        const plan = rows[0]?.['QUERY PLAN']?.[0];
        const result = this.parsePlan(sql, plan);
        if (result.seqScans.length > 0) {
            this.logger.warn(`[QueryMonitor] Sequential scan detected on: ${result.seqScans.join(', ')} — ` +
                `consider adding an index. Query: ${sql.slice(0, 120)}`);
        }
        if (result.actualTimeMs !== null && result.actualTimeMs > 100) {
            this.logger.warn(`[QueryMonitor] Slow query detected (${result.actualTimeMs.toFixed(1)}ms): ${sql.slice(0, 120)}`);
        }
        return result;
    }
    async runHealthCheck(sessionId) {
        const queries = [
            {
                label: 'metadata JSONB path query (should use GIN)',
                sql: `SELECT id FROM video_interviews WHERE metadata @> $1::jsonb`,
                params: ['{"locale":"en"}'],
            },
            {
                label: 'scores JSONB trait query (should use GIN)',
                sql: `SELECT id FROM interview_evaluations WHERE scores @> $1::jsonb`,
                params: ['{"traits":{}}'],
            },
            {
                label: 'rawWhisperResponse language query (should use GIN)',
                sql: `SELECT id FROM video_responses WHERE "rawWhisperResponse" @> $1::jsonb`,
                params: ['{"language":"en"}'],
            },
            {
                label: 'session + responses join (should use B-tree idx)',
                sql: `SELECT vi.id, COUNT(vr.id) FROM video_interviews vi
              LEFT JOIN video_responses vr ON vr."videoInterviewId" = vi.id
              WHERE vi.id = $1 GROUP BY vi.id`,
                params: [sessionId],
            },
        ];
        this.logger.log('[QueryMonitor] Running video-interview GIN index health check…');
        for (const { label, sql, params } of queries) {
            try {
                const plan = await this.analyzeQuery(sql, params);
                const status = plan.seqScans.length === 0 ? '✓ INDEX SCAN' : '✗ SEQ SCAN';
                this.logger.log(`[QueryMonitor] ${status} | ${label} | ${plan.actualTimeMs?.toFixed(2) ?? '?'}ms`);
            }
            catch (err) {
                this.logger.error(`[QueryMonitor] Health check failed for "${label}": ${err.message}`);
            }
        }
    }
    parsePlan(sql, plan) {
        const indexesUsed = [];
        const seqScans = [];
        const warnings = [];
        if (plan) {
            this.walkPlan(plan, indexesUsed, seqScans);
        }
        const planNode = plan?.['Plan'];
        const totalCost = planNode?.['Total Cost'] ?? null;
        const actualTime = planNode?.['Actual Total Time'] ?? null;
        if (seqScans.length > 0) {
            warnings.push(`Sequential scan(s) on: ${seqScans.join(', ')}`);
        }
        return {
            query: sql,
            planRows: plan ? [plan] : [],
            totalCostEstimate: totalCost,
            actualTimeMs: actualTime,
            indexesUsed,
            seqScans,
            warnings,
        };
    }
    walkPlan(node, indexesUsed, seqScans) {
        const nodeType = node['Node Type'];
        if (nodeType === 'Bitmap Index Scan' ||
            nodeType === 'Index Scan' ||
            nodeType === 'Index Only Scan') {
            const idxName = node['Index Name'];
            if (idxName)
                indexesUsed.push(idxName);
        }
        if (nodeType === 'Seq Scan') {
            const rel = node['Relation Name'];
            if (rel)
                seqScans.push(rel);
        }
        const plans = node['Plans'];
        if (Array.isArray(plans)) {
            for (const child of plans)
                this.walkPlan(child, indexesUsed, seqScans);
        }
    }
};
exports.QueryMonitorService = QueryMonitorService;
exports.QueryMonitorService = QueryMonitorService = QueryMonitorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], QueryMonitorService);
//# sourceMappingURL=query-monitor.service.js.map