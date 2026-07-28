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
var DbIndexMasterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbIndexMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const client_1 = require("@prisma/client");
const MAX_QUERY_LENGTH = 4_000;
const SEQ_SCAN_THRESHOLD = 1_000;
let DbIndexMasterService = DbIndexMasterService_1 = class DbIndexMasterService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(DbIndexMasterService_1.name);
    }
    async explainQuery(sql, _params = []) {
        this.validateQuerySql(sql);
        const sanitisedForLog = this.sanitiseSqlForLog(sql);
        this.logger.log(`EXPLAIN requested: ${sanitisedForLog}`);
        try {
            const explainSql = client_1.Prisma.sql `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${client_1.Prisma.raw(sql)}`;
            const rows = await this.prisma.$queryRaw(explainSql);
            const plan = rows[0]['QUERY PLAN'][0];
            const summary = this.buildPlanSummary(plan, sql);
            return {
                sql: sanitisedForLog,
                plan,
                summary,
                analysedAt: new Date().toISOString(),
            };
        }
        catch (err) {
            this.logger.error(`EXPLAIN failed for: ${sanitisedForLog}`, err);
            throw new common_1.InternalServerErrorException('EXPLAIN ANALYZE execution failed. Check server logs for details.');
        }
    }
    async listIndexes() {
        const rows = await this.prisma.$queryRaw `
      SELECT
        schemaname                            AS "schema",
        relname                               AS "table",
        indexrelname                          AS "index",
        idx_scan                              AS "scans",
        idx_tup_read                          AS "tuplesRead",
        idx_tup_fetch                         AS "tuplesFetched",
        pg_size_pretty(pg_relation_size(indexrelid)) AS "sizeHuman",
        pg_relation_size(indexrelid)          AS "sizeBytes"
      FROM pg_stat_user_indexes
      WHERE schemaname = 'public'
      ORDER BY "scans" ASC, "sizeBytes" DESC;
    `;
        return rows;
    }
    async unusedIndexes() {
        const all = await this.listIndexes();
        return all.filter((r) => Number(r.scans) === 0);
    }
    async heavySeqScanTables() {
        const rows = await this.prisma.$queryRaw `
      SELECT
        relname          AS "table",
        seq_scan         AS "seqScans",
        seq_tup_read     AS "seqTuplesRead",
        idx_scan         AS "idxScans",
        n_live_tup       AS "liveRows",
        CASE
          WHEN (seq_scan + idx_scan) > 0
          THEN ROUND(100.0 * idx_scan / (seq_scan + idx_scan), 2)
          ELSE 0
        END              AS "idxHitPercent"
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
        AND seq_scan > ${SEQ_SCAN_THRESHOLD}
      ORDER BY seq_scan DESC;
    `;
        return rows;
    }
    async fullReport() {
        const [unused, seqTables, allIndexes] = await Promise.all([
            this.unusedIndexes(),
            this.heavySeqScanTables(),
            this.listIndexes(),
        ]);
        const suggestions = this.generateSuggestions(seqTables);
        const totalIndexSizeBytes = allIndexes.reduce((acc, r) => acc + Number(r.sizeBytes ?? 0), 0);
        return {
            generatedAt: new Date().toISOString(),
            totalIndexes: allIndexes.length,
            unusedIndexCount: unused.length,
            unusedIndexes: unused,
            heavySeqScanTables: seqTables,
            suggestions,
            totalIndexSizeHuman: this.bytesToHuman(totalIndexSizeBytes),
        };
    }
    validateQuerySql(sql) {
        if (!sql || typeof sql !== 'string') {
            throw new common_1.BadRequestException('SQL must be a non-empty string.');
        }
        if (sql.length > MAX_QUERY_LENGTH) {
            throw new common_1.BadRequestException(`SQL exceeds maximum allowed length of ${MAX_QUERY_LENGTH} characters.`);
        }
        const BLOCKED_PATTERNS = [
            /\bDROP\b/i,
            /\bTRUNCATE\b/i,
            /\bALTER\b/i,
            /\bCREATE\b/i,
            /\bINSERT\b/i,
            /\bGRANT\b/i,
            /\bREVOKE\b/i,
            /;\s*--/,
            /;.*\w/,
        ];
        for (const pattern of BLOCKED_PATTERNS) {
            if (pattern.test(sql)) {
                throw new common_1.BadRequestException('SQL contains disallowed keywords. Only read and DML statements are permitted.');
            }
        }
    }
    sanitiseSqlForLog(sql) {
        return sql
            .replace(/'[^']*'/g, "'[REDACTED]'")
            .replace(/"[^"]{20,}"/g, '"[REDACTED]"')
            .replace(/\s+/g, ' ')
            .trim();
    }
    buildPlanSummary(plan, originalSql) {
        const root = plan['Plan'];
        const totalCost = root?.['Total Cost'] ?? 0;
        const actualMs = root?.['Actual Total Time'] ?? 0;
        const rows = root?.['Actual Rows'] ?? 0;
        const planType = root?.['Node Type'] ?? 'Unknown';
        const seqScan = this.treeContains(root, 'Seq Scan');
        const indexScan = this.treeContains(root, 'Index Scan');
        const indexOnlyScan = this.treeContains(root, 'Index Only Scan');
        const warning = [];
        if (seqScan)
            warning.push('Sequential scan detected — consider adding an index.');
        if (totalCost > 10_000)
            warning.push('High estimated cost — query may be slow on large data.');
        if (actualMs > 1_000)
            warning.push('Execution time exceeded 1 second.');
        const suggestion = this.suggestIndexTypeFromPlan(originalSql, root);
        return {
            topNodeType: planType,
            estimatedTotalCost: totalCost,
            actualExecutionMs: actualMs,
            estimatedRows: rows,
            usesSeqScan: seqScan,
            usesIndexScan: indexScan || indexOnlyScan,
            warnings: warning,
            indexSuggestion: suggestion ?? undefined,
        };
    }
    treeContains(node, nodeType) {
        if (!node)
            return false;
        if (node['Node Type'] === nodeType)
            return true;
        const plans = node['Plans'];
        if (Array.isArray(plans)) {
            return plans.some((p) => this.treeContains(p, nodeType));
        }
        return false;
    }
    suggestIndexTypeFromPlan(sql, plan) {
        const upper = sql.toUpperCase();
        if (upper.includes('@>') || upper.includes('@@') || upper.includes('TO_TSVECTOR')) {
            return 'GIN index recommended for array/full-text operations.';
        }
        if ((upper.includes('CREATED_AT') || upper.includes('CREATEDAT')) &&
            (upper.includes('BETWEEN') || upper.includes('>') || upper.includes('<'))) {
            return 'BRIN index recommended for timestamp range queries on large, append-only tables.';
        }
        if (plan && this.treeContains(plan, 'Seq Scan')) {
            return 'B-Tree index recommended on the filtered column(s) to replace sequential scan.';
        }
        return null;
    }
    generateSuggestions(tables) {
        return tables.map((t) => ({
            table: t.table,
            reason: `${t.seqScans.toLocaleString()} sequential scans with ${t.liveRows.toLocaleString()} live rows.`,
            recommendation: `Consider a B-Tree index on the most-filtered column. Index hit rate: ${t.idxHitPercent}%.`,
            priority: Number(t.seqScans) > 10_000 ? 'HIGH' : 'MEDIUM',
        }));
    }
    bytesToHuman(bytes) {
        if (bytes < 1_024)
            return `${bytes} B`;
        if (bytes < 1_048_576)
            return `${(bytes / 1_024).toFixed(1)} KB`;
        if (bytes < 1_073_741_824)
            return `${(bytes / 1_048_576).toFixed(1)} MB`;
        return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
    }
};
exports.DbIndexMasterService = DbIndexMasterService;
exports.DbIndexMasterService = DbIndexMasterService = DbIndexMasterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DbIndexMasterService);
//# sourceMappingURL=db-index-master.service.js.map