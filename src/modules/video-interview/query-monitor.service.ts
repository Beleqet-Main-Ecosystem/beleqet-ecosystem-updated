import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Result of an EXPLAIN ANALYZE query. */
export interface ExecutionPlan {
  query: string;
  planRows: unknown[];
  totalCostEstimate: number | null;
  actualTimeMs: number | null;
  indexesUsed: string[];
  seqScans: string[];
  warnings: string[];
}

/**
 * Query performance monitoring service for the Video Interview module.
 *
 * Uses PostgreSQL `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` to capture
 * execution plans for critical JSONB queries and detect missing index usage.
 *
 * In production this runs on-demand (e.g. admin endpoint or slow-query threshold).
 * In development it logs plans automatically for all video-interview queries.
 *
 * @example
 * ```ts
 * const plan = await this.queryMonitor.analyzeQuery(
 *   `SELECT * FROM video_interviews WHERE metadata @> $1::jsonb`,
 *   ['{"locale":"am"}'],
 * );
 * if (plan.seqScans.length) this.logger.warn('Missing GIN index on metadata!');
 * ```
 */
@Injectable()
export class QueryMonitorService {
  private readonly logger = new Logger(QueryMonitorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run EXPLAIN ANALYZE on a raw SQL query and parse the execution plan.
   *
   * @param sql     Parameterised SQL (use $1, $2 … placeholders).
   * @param params  Bind parameters matching the placeholders.
   * @returns       Parsed {@link ExecutionPlan} with index usage and timing.
   */
  async analyzeQuery(sql: string, params: unknown[] = []): Promise<ExecutionPlan> {
    const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;

    const rows = await this.prisma.$queryRawUnsafe<[{ 'QUERY PLAN': unknown[] }]>(
      explainSql,
      ...params,
    );

    const plan = rows[0]?.['QUERY PLAN']?.[0] as Record<string, unknown> | undefined;

    const result = this.parsePlan(sql, plan);

    if (result.seqScans.length > 0) {
      this.logger.warn(
        `[QueryMonitor] Sequential scan detected on: ${result.seqScans.join(', ')} — ` +
        `consider adding an index. Query: ${sql.slice(0, 120)}`,
      );
    }

    if (result.actualTimeMs !== null && result.actualTimeMs > 100) {
      this.logger.warn(
        `[QueryMonitor] Slow query detected (${result.actualTimeMs.toFixed(1)}ms): ${sql.slice(0, 120)}`,
      );
    }

    return result;
  }

  /**
   * Run EXPLAIN ANALYZE for the most critical video-interview JSONB queries
   * and log a performance report. Useful in dev/staging to verify GIN index usage.
   *
   * @param sessionId  A real VideoInterview UUID to use as the query parameter.
   */
  async runHealthCheck(sessionId: string): Promise<void> {
    const queries: Array<{ label: string; sql: string; params: unknown[] }> = [
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
        this.logger.log(
          `[QueryMonitor] ${status} | ${label} | ${plan.actualTimeMs?.toFixed(2) ?? '?'}ms`,
        );
      } catch (err) {
        this.logger.error(`[QueryMonitor] Health check failed for "${label}": ${(err as Error).message}`);
      }
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private parsePlan(sql: string, plan: Record<string, unknown> | undefined): ExecutionPlan {
    const indexesUsed: string[] = [];
    const seqScans: string[]   = [];
    const warnings: string[]   = [];

    if (plan) {
      this.walkPlan(plan, indexesUsed, seqScans);
    }

    const planNode = plan?.['Plan'] as Record<string, unknown> | undefined;
    const totalCost   = planNode?.['Total Cost'] as number | null ?? null;
    const actualTime  = planNode?.['Actual Total Time'] as number | null ?? null;

    if (seqScans.length > 0) {
      warnings.push(`Sequential scan(s) on: ${seqScans.join(', ')}`);
    }

    return { query: sql, planRows: plan ? [plan] : [], totalCostEstimate: totalCost, actualTimeMs: actualTime, indexesUsed, seqScans, warnings };
  }

  private walkPlan(
    node: Record<string, unknown>,
    indexesUsed: string[],
    seqScans: string[],
  ): void {
    const nodeType = node['Node Type'] as string | undefined;

    if (nodeType === 'Bitmap Index Scan' || nodeType === 'Index Scan' || nodeType === 'Index Only Scan') {
      const idxName = node['Index Name'] as string | undefined;
      if (idxName) indexesUsed.push(idxName);
    }
    if (nodeType === 'Seq Scan') {
      const rel = node['Relation Name'] as string | undefined;
      if (rel) seqScans.push(rel);
    }

    const plans = node['Plans'] as Record<string, unknown>[] | undefined;
    if (Array.isArray(plans)) {
      for (const child of plans) this.walkPlan(child, indexesUsed, seqScans);
    }
  }
}
