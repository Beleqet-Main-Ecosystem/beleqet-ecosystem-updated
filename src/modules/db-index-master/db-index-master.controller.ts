/**
 * @file db-index-master.controller.ts
 * @description
 * REST controller exposing DB Index Master analysis endpoints.
 * All routes are protected: JWT authentication + ADMIN role required.
 *
 * Base path: /api/v1/admin/db-index
 *
 * Endpoints:
 *   POST /explain           — EXPLAIN ANALYZE a provided SQL statement
 *   GET  /indexes           — List all indexes with usage stats
 *   GET  /indexes/unused    — List zero-scan (unused) indexes
 *   GET  /tables/seq-scans  — Tables with heavy sequential scans
 *   GET  /report            — Full health report with suggestions
 */
import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { DbIndexMasterService } from './db-index-master.service';
import { ExplainQueryDto } from './dto/explain-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('db-index-master')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/db-index')
export class DbIndexMasterController {
  constructor(private readonly service: DbIndexMasterService) {}

  // ─────────────────────────────────────────────────────────────
  // POST /explain
  // ─────────────────────────────────────────────────────────────

  /**
   * Run EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) on the provided SQL.
   * Only SELECT/UPDATE/DELETE statements are permitted; DDL is rejected.
   */
  @Post('explain')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'EXPLAIN ANALYZE a SQL query',
    description:
      'Executes EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) and returns the ' +
      'parsed plan with a human-friendly summary and index suggestions. ' +
      'PII string literals are redacted from logged output.',
  })
  @ApiBody({ type: ExplainQueryDto })
  @ApiResponse({ status: 200, description: 'Execution plan returned.' })
  @ApiResponse({ status: 400, description: 'SQL validation failed.' })
  @ApiResponse({ status: 401, description: 'Unauthenticated.' })
  @ApiResponse({ status: 403, description: 'Admin role required.' })
  explainQuery(@Body() dto: ExplainQueryDto) {
    return this.service.explainQuery(dto.sql, dto.params ?? []);
  }

  // ─────────────────────────────────────────────────────────────
  // GET /indexes
  // ─────────────────────────────────────────────────────────────

  /**
   * Return all user-created indexes in the public schema with size and
   * usage statistics from pg_stat_user_indexes.
   */
  @Get('indexes')
  @ApiOperation({ summary: 'List all indexes with usage stats' })
  @ApiResponse({ status: 200, description: 'Index list returned.' })
  listIndexes() {
    return this.service.listIndexes();
  }

  // ─────────────────────────────────────────────────────────────
  // GET /indexes/unused
  // ─────────────────────────────────────────────────────────────

  /**
   * Return indexes that have never been scanned since the last stats reset.
   * These are candidates for removal.
   */
  @Get('indexes/unused')
  @ApiOperation({ summary: 'List unused (zero-scan) indexes' })
  @ApiResponse({ status: 200, description: 'Unused index list returned.' })
  unusedIndexes() {
    return this.service.unusedIndexes();
  }

  // ─────────────────────────────────────────────────────────────
  // GET /tables/seq-scans
  // ─────────────────────────────────────────────────────────────

  /**
   * Return tables with sequential scan counts above the configured threshold.
   * High seq_scan on large tables usually means a missing index.
   */
  @Get('tables/seq-scans')
  @ApiOperation({ summary: 'Tables with heavy sequential scans' })
  @ApiResponse({ status: 200, description: 'Table scan stats returned.' })
  seqScanTables() {
    return this.service.heavySeqScanTables();
  }

  // ─────────────────────────────────────────────────────────────
  // GET /report
  // ─────────────────────────────────────────────────────────────

  /**
   * Generate a full database-index health report:
   *   - Total index count and combined size
   *   - Unused indexes (write overhead wasted)
   *   - Tables with high seq_scan (missing index candidates)
   *   - Auto-generated index-type recommendations
   */
  @Get('report')
  @ApiOperation({ summary: 'Full index health report with suggestions' })
  @ApiResponse({ status: 200, description: 'Full report returned.' })
  fullReport() {
    return this.service.fullReport();
  }
}
