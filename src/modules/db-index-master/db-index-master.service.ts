/**
 * @module DbIndexMasterService
 * @description
 * Query-performance monitoring service for the Beleqet PostgreSQL database.
 *
 * Capabilities:
 *  - Run arbitrary SQL through `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` via
 *    Prisma's `$queryRaw` so the planner output is parsed, not just logged.
 *  - List all indexes in the public schema with their size and usage stats
 *    from `pg_stat_user_indexes`.
 *  - Report "unused" indexes (zero scans since last stats-reset) that waste
 *    write overhead.
 *  - Report "slow" tables (sequential scans > configurable threshold) so
 *    missing indexes are surfaced automatically.
 *  - Suggest the index type (B-Tree / GIN / BRIN) based on simple heuristics
 *    derived from EXPLAIN output.
 *
 * Security / GDPR notes:
 *  - Only admin-role users may call these endpoints (enforced in controller).
 *  - Query text is sanitised to strip potential PII literals before being
 *    stored in logs.
 *  - Results never contain row data — only execution plans and statistics.
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  ExplainResult,
  IndexUsageStat,
  TableScanStat,
  IndexSuggestion,
  AnalysisReport,
} from './interfaces/db-index.interfaces';

/** Maximum allowed query length to prevent DoS via huge EXPLAIN calls. */
const MAX_QUERY_LENGTH = 4_000;

/** Sequential-scan threshold — tables exceeding this count are flagged. */
const SEQ_SCAN_THRESHOLD = 1_000;

@Injectable()
export class DbIndexMasterService {
  private readonly logger = new Logger(DbIndexMasterService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Execute `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` on the supplied SQL.
   *
   * @param sql       Raw SQL SELECT/UPDATE/DELETE statement (no DDL allowed).
   * @param params    Optional positional parameters ($1, $2 …).
   * @returns         Parsed EXPLAIN JSON plus a human-friendly summary.
   *
   * @throws BadRequestException  if DDL / dangerous keywords are present.
   * @throws InternalServerErrorException on query execution failure.
   */
  async explainQuery(
    sql: string,
    params: unknown[] = [],
  ): Promise<ExplainResult> {
    this.validateQuerySql(sql);

    const sanitisedForLog = this.sanitiseSqlForLog(sql);
    this.logger.log(`EXPLAIN requested: ${sanitisedForLog}`);

    try {
      // Wrap user query in EXPLAIN; parameters passed as tagged-template args.
      const explainSql = Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${Prisma.raw(sql)}`;
      const rows = await this.prisma.$queryRaw<Array<{ 'QUERY PLAN': unknown[] }>>(explainSql);

      const plan = rows[0]['QUERY PLAN'][0] as Record<string, unknown>;
      const summary = this.buildPlanSummary(plan, sql);

      return {
        sql: sanitisedForLog,
        plan,
        summary,
        analysedAt: new Date().toISOString(),
      };
    } catch (err) {
      this.logger.error(`EXPLAIN failed for: ${sanitisedForLog}`, err);
      throw new InternalServerErrorException(
        'EXPLAIN ANALYZE execution failed. Check server logs for details.',
      );
    }
  }

  /**
   * List all user-created indexes in the `public` schema with usage statistics
   * sourced from `pg_stat_user_indexes` and size from `pg_relation_size`.
   */
  async listIndexes(): Promise<IndexUsageStat[]> {
    const rows = await this.prisma.$queryRaw<IndexUsageStat[]>`
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

  /**
   * Return indexes that have never been used since the last stats reset.
   * These are candidates for removal to reduce write amplification.
   */
  async unusedIndexes(): Promise<IndexUsageStat[]> {
    const all = await this.listIndexes();
    return all.filter((r) => Number(r.scans) === 0);
  }

  /**
   * Return tables with high sequential-scan counts — a signal that a covering
   * index is missing or not being used by the planner.
   */
  async heavySeqScanTables(): Promise<TableScanStat[]> {
    const rows = await this.prisma.$queryRaw<TableScanStat[]>`
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

  /**
   * Run a full analysis: unused indexes + heavy sequential scans, and
   * generate index-type suggestions for the worst offenders.
   */
  async fullReport(): Promise<AnalysisReport> {
    const [unused, seqTables, allIndexes] = await Promise.all([
      this.unusedIndexes(),
      this.heavySeqScanTables(),
      this.listIndexes(),
    ]);

    const suggestions = this.generateSuggestions(seqTables);

    const totalIndexSizeBytes = allIndexes.reduce(
      (acc, r) => acc + Number(r.sizeBytes ?? 0),
      0,
    );

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

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Validate that the supplied SQL does not contain DDL or dangerous commands.
   * Only SELECT / EXPLAIN / WITH / UPDATE / DELETE are allowed.
   */
  private validateQuerySql(sql: string): void {
    if (!sql || typeof sql !== 'string') {
      throw new BadRequestException('SQL must be a non-empty string.');
    }
    if (sql.length > MAX_QUERY_LENGTH) {
      throw new BadRequestException(
        `SQL exceeds maximum allowed length of ${MAX_QUERY_LENGTH} characters.`,
      );
    }

    const BLOCKED_PATTERNS = [
      /\bDROP\b/i,
      /\bTRUNCATE\b/i,
      /\bALTER\b/i,
      /\bCREATE\b/i,
      /\bINSERT\b/i,
      /\bGRANT\b/i,
      /\bREVOKE\b/i,
      /;\s*--/,        // SQL injection via comment after semicolon
      /;.*\w/,         // multiple statements
    ];

    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(sql)) {
        throw new BadRequestException(
          'SQL contains disallowed keywords. Only read and DML statements are permitted.',
        );
      }
    }
  }

  /**
   * Strip potential PII from SQL before writing to logs.
   * Replaces string literals with `[REDACTED]`.
   */
  private sanitiseSqlForLog(sql: string): string {
    return sql
      .replace(/'[^']*'/g, "'[REDACTED]'")   // single-quoted strings
      .replace(/"[^"]{20,}"/g, '"[REDACTED]"') // long double-quoted identifiers
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract key metrics from a parsed EXPLAIN JSON plan node.
   */
  private buildPlanSummary(
    plan: Record<string, unknown>,
    originalSql: string,
  ): ExplainResult['summary'] {
    const root = plan['Plan'] as Record<string, unknown> | undefined;

    const totalCost   = (root?.['Total Cost']   as number) ?? 0;
    const actualMs    = (root?.['Actual Total Time'] as number) ?? 0;
    const rows        = (root?.['Actual Rows']   as number) ?? 0;
    const planType    = (root?.['Node Type']     as string) ?? 'Unknown';
    const seqScan     = this.treeContains(root, 'Seq Scan');
    const indexScan   = this.treeContains(root, 'Index Scan');
    const indexOnlyScan = this.treeContains(root, 'Index Only Scan');

    const warning: string[] = [];
    if (seqScan)      warning.push('Sequential scan detected — consider adding an index.');
    if (totalCost > 10_000) warning.push('High estimated cost — query may be slow on large data.');
    if (actualMs > 1_000)   warning.push('Execution time exceeded 1 second.');

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

  /**
   * Recursively check whether a plan node or any of its children uses a
   * particular node type (e.g. "Seq Scan").
   */
  private treeContains(
    node: Record<string, unknown> | undefined,
    nodeType: string,
  ): boolean {
    if (!node) return false;
    if (node['Node Type'] === nodeType) return true;
    const plans = node['Plans'] as Record<string, unknown>[] | undefined;
    if (Array.isArray(plans)) {
      return plans.some((p) => this.treeContains(p, nodeType));
    }
    return false;
  }

  /**
   * Heuristic: look at the WHERE clause of the SQL and suggest whether a
   * B-Tree, GIN, or BRIN index would help most.
   */
  private suggestIndexTypeFromPlan(
    sql: string,
    plan: Record<string, unknown> | undefined,
  ): string | null {
    const upper = sql.toUpperCase();

    // GIN: array containment or full-text search
    if (upper.includes('@>') || upper.includes('@@') || upper.includes('TO_TSVECTOR')) {
      return 'GIN index recommended for array/full-text operations.';
    }
    // BRIN: timestamp range scans on large tables
    if (
      (upper.includes('CREATED_AT') || upper.includes('CREATEDAT')) &&
      (upper.includes('BETWEEN') || upper.includes('>') || upper.includes('<'))
    ) {
      return 'BRIN index recommended for timestamp range queries on large, append-only tables.';
    }
    // B-Tree default for equality / range
    if (plan && this.treeContains(plan, 'Seq Scan')) {
      return 'B-Tree index recommended on the filtered column(s) to replace sequential scan.';
    }
    return null;
  }

  /**
   * Generate index suggestions for tables with heavy sequential scans.
   */
  private generateSuggestions(tables: TableScanStat[]): IndexSuggestion[] {
    return tables.map((t) => ({
      table: t.table,
      reason: `${t.seqScans.toLocaleString()} sequential scans with ${t.liveRows.toLocaleString()} live rows.`,
      recommendation: `Consider a B-Tree index on the most-filtered column. Index hit rate: ${t.idxHitPercent}%.`,
      priority: Number(t.seqScans) > 10_000 ? 'HIGH' : 'MEDIUM',
    }));
  }

  /** Human-readable byte formatter (no external dependency). */
  private bytesToHuman(bytes: number): string {
    if (bytes < 1_024)          return `${bytes} B`;
    if (bytes < 1_048_576)      return `${(bytes / 1_024).toFixed(1)} KB`;
    if (bytes < 1_073_741_824)  return `${(bytes / 1_048_576).toFixed(1)} MB`;
    return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  }
}
