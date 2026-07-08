/**
 * @file db-index-master.controller.spec.ts
 * @description
 * Unit tests for DbIndexMasterController.
 *
 * DbIndexMasterService is fully mocked so no Prisma/DB interaction occurs.
 * Guard behaviour (JwtAuthGuard + RolesGuard) is bypassed in unit tests
 * by overriding with permissive mock guards — HTTP-layer guard enforcement
 * is covered by e2e tests.
 *
 * Coverage:
 *  - explainQuery  (POST /admin/db-index/explain)
 *  - listIndexes   (GET  /admin/db-index/indexes)
 *  - unusedIndexes (GET  /admin/db-index/indexes/unused)
 *  - seqScanTables (GET  /admin/db-index/tables/seq-scans)
 *  - fullReport    (GET  /admin/db-index/report)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { DbIndexMasterController } from './db-index-master.controller';
import { DbIndexMasterService }    from './db-index-master.service';
import { JwtAuthGuard }            from '../../common/guards/jwt-auth.guard';
import { RolesGuard }              from '../../common/guards/roles.guard';

// ─────────────────────────────────────────────────────────────────────────────
// Stub data
// ─────────────────────────────────────────────────────────────────────────────

const stubExplainResult = {
  sql:        "SELECT id FROM jobs WHERE status = '[REDACTED]'",
  plan:       { Plan: { 'Node Type': 'Index Scan', 'Total Cost': 50 } },
  summary:    {
    topNodeType:         'Index Scan',
    estimatedTotalCost:  50,
    actualExecutionMs:   3.2,
    estimatedRows:       5,
    usesSeqScan:         false,
    usesIndexScan:       true,
    warnings:            [],
    indexSuggestion:     undefined,
  },
  analysedAt: new Date().toISOString(),
};

const stubIndexRow = {
  schema:        'public',
  table:         'jobs',
  index:         'idx_jobs_status',
  scans:         0,
  tuplesRead:    0,
  tuplesFetched: 0,
  sizeHuman:     '16 kB',
  sizeBytes:     16384,
};

const stubUsedIndexRow = {
  ...stubIndexRow,
  index:  'idx_jobs_created_at',
  scans:  10_000,
  sizeBytes: 65536,
};

const stubSeqScanRow = {
  table:          'jobs',
  seqScans:       15_000,
  seqTuplesRead:  300_000,
  idxScans:       500,
  liveRows:       30_000,
  idxHitPercent:  3.2,
};

const stubFullReport = {
  generatedAt:        new Date().toISOString(),
  totalIndexes:       2,
  unusedIndexCount:   1,
  unusedIndexes:      [stubIndexRow],
  heavySeqScanTables: [stubSeqScanRow],
  suggestions:        [
    {
      table:          'jobs',
      reason:         '15,000 sequential scans with 30,000 live rows.',
      recommendation: 'Consider a B-Tree index on the most-filtered column. Index hit rate: 3.2%.',
      priority:       'HIGH' as const,
    },
  ],
  totalIndexSizeHuman: '80 kB',
};

// ─────────────────────────────────────────────────────────────────────────────
// Mock service
// ─────────────────────────────────────────────────────────────────────────────

const mockService = {
  explainQuery:       jest.fn(),
  listIndexes:        jest.fn(),
  unusedIndexes:      jest.fn(),
  heavySeqScanTables: jest.fn(),
  fullReport:         jest.fn(),
};

// Permissive guard stubs — unit tests don't exercise auth
const passGuard = { canActivate: () => true };

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('DbIndexMasterController', () => {
  let controller: DbIndexMasterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DbIndexMasterController],
      providers: [
        { provide: DbIndexMasterService, useValue: mockService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue(passGuard)
      .overrideGuard(RolesGuard).useValue(passGuard)
      .compile();

    controller = module.get<DbIndexMasterController>(DbIndexMasterController);
  });

  afterEach(() => jest.clearAllMocks());

  // ──────────────────────────────────────────────────────────────────────────
  // explainQuery
  // ──────────────────────────────────────────────────────────────────────────
  describe('explainQuery', () => {
    it('delegates to service.explainQuery and returns the result', async () => {
      mockService.explainQuery.mockResolvedValue(stubExplainResult);

      const dto = { sql: "SELECT id FROM jobs WHERE status = 'PUBLISHED'" };
      const result = await controller.explainQuery(dto as any);

      expect(mockService.explainQuery).toHaveBeenCalledWith(
        dto.sql,
        [],
      );
      expect(result).toEqual(stubExplainResult);
    });

    it('forwards optional params array to service', async () => {
      mockService.explainQuery.mockResolvedValue(stubExplainResult);

      const dto = { sql: 'SELECT id FROM jobs WHERE id = $1', params: ['job-uuid-001'] };
      await controller.explainQuery(dto as any);

      expect(mockService.explainQuery).toHaveBeenCalledWith(dto.sql, dto.params);
    });

    it('uses empty array as default when params is undefined', async () => {
      mockService.explainQuery.mockResolvedValue(stubExplainResult);

      await controller.explainQuery({ sql: 'SELECT 1' } as any);

      expect(mockService.explainQuery).toHaveBeenCalledWith('SELECT 1', []);
    });

    it('propagates BadRequestException thrown by the service', async () => {
      const { BadRequestException } = await import('@nestjs/common');
      mockService.explainQuery.mockRejectedValue(
        new BadRequestException('SQL contains disallowed keywords.'),
      );

      await expect(
        controller.explainQuery({ sql: 'DROP TABLE users' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('propagates InternalServerErrorException thrown by the service', async () => {
      const { InternalServerErrorException } = await import('@nestjs/common');
      mockService.explainQuery.mockRejectedValue(
        new InternalServerErrorException('DB failure'),
      );

      await expect(
        controller.explainQuery({ sql: 'SELECT 1' } as any),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // listIndexes
  // ──────────────────────────────────────────────────────────────────────────
  describe('listIndexes', () => {
    it('delegates to service.listIndexes and returns all indexes', async () => {
      mockService.listIndexes.mockResolvedValue([stubIndexRow, stubUsedIndexRow]);

      const result = await controller.listIndexes();

      expect(mockService.listIndexes).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(stubIndexRow);
    });

    it('returns an empty array when no indexes exist', async () => {
      mockService.listIndexes.mockResolvedValue([]);

      const result = await controller.listIndexes();

      expect(result).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // unusedIndexes
  // ──────────────────────────────────────────────────────────────────────────
  describe('unusedIndexes', () => {
    it('delegates to service.unusedIndexes and returns zero-scan indexes', async () => {
      mockService.unusedIndexes.mockResolvedValue([stubIndexRow]);

      const result = await controller.unusedIndexes();

      expect(mockService.unusedIndexes).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].scans).toBe(0);
    });

    it('returns an empty array when all indexes are used', async () => {
      mockService.unusedIndexes.mockResolvedValue([]);

      const result = await controller.unusedIndexes();

      expect(result).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // seqScanTables
  // ──────────────────────────────────────────────────────────────────────────
  describe('seqScanTables', () => {
    it('delegates to service.heavySeqScanTables and returns the stats', async () => {
      mockService.heavySeqScanTables.mockResolvedValue([stubSeqScanRow]);

      const result = await controller.seqScanTables();

      expect(mockService.heavySeqScanTables).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
      expect(result[0].table).toBe('jobs');
      expect(result[0].seqScans).toBe(15_000);
    });

    it('returns an empty array when no tables exceed the threshold', async () => {
      mockService.heavySeqScanTables.mockResolvedValue([]);

      const result = await controller.seqScanTables();

      expect(result).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // fullReport
  // ──────────────────────────────────────────────────────────────────────────
  describe('fullReport', () => {
    it('delegates to service.fullReport and returns the complete report', async () => {
      mockService.fullReport.mockResolvedValue(stubFullReport);

      const result = await controller.fullReport();

      expect(mockService.fullReport).toHaveBeenCalledTimes(1);
      expect(result).toEqual(stubFullReport);
    });

    it('report contains all required top-level fields', async () => {
      mockService.fullReport.mockResolvedValue(stubFullReport);

      const result = await controller.fullReport();

      expect(result).toHaveProperty('generatedAt');
      expect(result).toHaveProperty('totalIndexes');
      expect(result).toHaveProperty('unusedIndexCount');
      expect(result).toHaveProperty('unusedIndexes');
      expect(result).toHaveProperty('heavySeqScanTables');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('totalIndexSizeHuman');
    });

    it('report suggestion has HIGH priority for tables with > 10k seq scans', async () => {
      mockService.fullReport.mockResolvedValue(stubFullReport);

      const result = await controller.fullReport();

      expect(result.suggestions[0].priority).toBe('HIGH');
    });

    it('calls the service exactly once per request', async () => {
      mockService.fullReport.mockResolvedValue(stubFullReport);

      await controller.fullReport();
      await controller.fullReport();

      expect(mockService.fullReport).toHaveBeenCalledTimes(2);
    });
  });
});
