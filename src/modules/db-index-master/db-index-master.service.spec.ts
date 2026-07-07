/**
 * @file db-index-master.service.spec.ts
 * @description Unit tests for DbIndexMasterService.
 *
 * All external I/O (Prisma $queryRaw) is mocked so tests run fully in-memory
 * without a live PostgreSQL connection.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { DbIndexMasterService } from './db-index-master.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─────────────────────────────────────────────────────────────────────────────
// Minimal mock of a pg_stat_user_indexes row
// ─────────────────────────────────────────────────────────────────────────────
const mockIndexRow = {
  schema: 'public',
  table: 'jobs',
  index: 'idx_jobs_fts',
  scans: 0,
  tuplesRead: 0,
  tuplesFetched: 0,
  sizeHuman: '16 kB',
  sizeBytes: 16384,
};

const mockUsedIndexRow = {
  ...mockIndexRow,
  index: 'idx_jobs_published',
  scans: 5_000,
  sizeBytes: 65536,
  sizeHuman: '64 kB',
};

const mockSeqScanRow = {
  table: 'jobs',
  seqScans: 12_000,
  seqTuplesRead: 240_000,
  idxScans: 800,
  liveRows: 20_000,
  idxHitPercent: 6.25,
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPLAIN plan stubs
// ─────────────────────────────────────────────────────────────────────────────
const mockExplainSeqScan = [
  {
    'QUERY PLAN': [
      {
        Plan: {
          'Node Type': 'Seq Scan',
          'Total Cost': 1500.0,
          'Actual Total Time': 120.5,
          'Actual Rows': 5000,
          Plans: [],
        },
      },
    ],
  },
];

const mockExplainIndexScan = [
  {
    'QUERY PLAN': [
      {
        Plan: {
          'Node Type': 'Index Scan',
          'Total Cost': 80.0,
          'Actual Total Time': 5.2,
          'Actual Rows': 10,
          Plans: [],
        },
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────
describe('DbIndexMasterService', () => {
  let service: DbIndexMasterService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DbIndexMasterService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DbIndexMasterService>(DbIndexMasterService);
  });

  afterEach(() => jest.clearAllMocks());

  // ──────────────────────────────────────────────────────────────────────────
  // explainQuery
  // ──────────────────────────────────────────────────────────────────────────
  describe('explainQuery', () => {
    it('returns a parsed ExplainResult for a valid SELECT', async () => {
      prisma.$queryRaw.mockResolvedValueOnce(mockExplainSeqScan);

      const result = await service.explainQuery(
        "SELECT id FROM jobs WHERE status = 'PUBLISHED'",
      );

      expect(result).toHaveProperty('sql');
      expect(result).toHaveProperty('plan');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('analysedAt');
      expect(result.summary.usesSeqScan).toBe(true);
      expect(result.summary.usesIndexScan).toBe(false);
      expect(result.summary.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Sequential scan detected'),
        ]),
      );
    });

    it('detects index scan in the plan', async () => {
      prisma.$queryRaw.mockResolvedValueOnce(mockExplainIndexScan);

      const result = await service.explainQuery('SELECT id FROM jobs WHERE id = $1');

      expect(result.summary.usesSeqScan).toBe(false);
      expect(result.summary.usesIndexScan).toBe(true);
    });

    it('suggests GIN index for @> operator in SQL', async () => {
      prisma.$queryRaw.mockResolvedValueOnce(mockExplainIndexScan);

      const result = await service.explainQuery(
        "SELECT id FROM jobs WHERE tags @> ARRAY['remote']",
      );

      expect(result.summary.indexSuggestion).toContain('GIN');
    });

    it('suggests BRIN index for timestamp range queries', async () => {
      prisma.$queryRaw.mockResolvedValueOnce(mockExplainIndexScan);

      const result = await service.explainQuery(
        'SELECT id FROM jobs WHERE created_at > NOW() - INTERVAL \'7 days\'',
      );

      expect(result.summary.indexSuggestion).toContain('BRIN');
    });

    it('redacts string literals from the logged sql', async () => {
      prisma.$queryRaw.mockResolvedValueOnce(mockExplainIndexScan);

      const result = await service.explainQuery(
        "SELECT * FROM users WHERE email = 'john@example.com'",
      );

      expect(result.sql).not.toContain('john@example.com');
      expect(result.sql).toContain('[REDACTED]');
    });

    it('throws BadRequestException for DROP statement', async () => {
      await expect(
        service.explainQuery('DROP TABLE users'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for CREATE statement', async () => {
      await expect(
        service.explainQuery('CREATE INDEX foo ON users(email)'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for TRUNCATE', async () => {
      await expect(
        service.explainQuery('TRUNCATE TABLE jobs'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when SQL exceeds 4000 chars', async () => {
      const longSql = 'SELECT ' + 'a,'.repeat(3000);
      await expect(service.explainQuery(longSql)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for empty SQL', async () => {
      await expect(service.explainQuery('')).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerErrorException when Prisma throws', async () => {
      prisma.$queryRaw.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(
        service.explainQuery('SELECT 1'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // listIndexes
  // ──────────────────────────────────────────────────────────────────────────
  describe('listIndexes', () => {
    it('returns the index list from Prisma', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([mockIndexRow, mockUsedIndexRow]);

      const result = await service.listIndexes();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('index', 'idx_jobs_fts');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // unusedIndexes
  // ──────────────────────────────────────────────────────────────────────────
  describe('unusedIndexes', () => {
    it('filters out indexes with scans > 0', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([mockIndexRow, mockUsedIndexRow]);

      const result = await service.unusedIndexes();

      expect(result).toHaveLength(1);
      expect(result[0].scans).toBe(0);
    });

    it('returns empty array when all indexes are used', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([mockUsedIndexRow]);

      const result = await service.unusedIndexes();

      expect(result).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // heavySeqScanTables
  // ──────────────────────────────────────────────────────────────────────────
  describe('heavySeqScanTables', () => {
    it('returns seq-scan rows from Prisma', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([mockSeqScanRow]);

      const result = await service.heavySeqScanTables();

      expect(result).toHaveLength(1);
      expect(result[0].table).toBe('jobs');
      expect(result[0].seqScans).toBe(12_000);
    });

    it('returns empty array when no heavy seq scans', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.heavySeqScanTables();

      expect(result).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // fullReport
  // ──────────────────────────────────────────────────────────────────────────
  describe('fullReport', () => {
    it('returns a complete AnalysisReport object', async () => {
      // unusedIndexes → listIndexes → heavySeqScan
      prisma.$queryRaw
        .mockResolvedValueOnce([mockIndexRow, mockUsedIndexRow]) // unusedIndexes (listIndexes call)
        .mockResolvedValueOnce([mockSeqScanRow])                 // heavySeqScanTables
        .mockResolvedValueOnce([mockIndexRow, mockUsedIndexRow]); // listIndexes (separate call in fullReport)

      const report = await service.fullReport();

      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('totalIndexes');
      expect(report).toHaveProperty('unusedIndexCount');
      expect(report).toHaveProperty('unusedIndexes');
      expect(report).toHaveProperty('heavySeqScanTables');
      expect(report).toHaveProperty('suggestions');
      expect(report).toHaveProperty('totalIndexSizeHuman');
    });

    it('marks suggestions as HIGH priority when seqScans > 10000', async () => {
      const highSeqRow = { ...mockSeqScanRow, seqScans: 50_000 };

      prisma.$queryRaw
        .mockResolvedValueOnce([mockIndexRow])
        .mockResolvedValueOnce([highSeqRow])
        .mockResolvedValueOnce([mockIndexRow]);

      const report = await service.fullReport();
      const suggestion = report.suggestions[0];

      expect(suggestion.priority).toBe('HIGH');
    });

    it('marks suggestions as MEDIUM priority when seqScans ≤ 10000', async () => {
      const medSeqRow = { ...mockSeqScanRow, seqScans: 5_000 };

      prisma.$queryRaw
        .mockResolvedValueOnce([mockIndexRow])
        .mockResolvedValueOnce([medSeqRow])
        .mockResolvedValueOnce([mockIndexRow]);

      const report = await service.fullReport();
      const suggestion = report.suggestions[0];

      expect(suggestion.priority).toBe('MEDIUM');
    });
  });
});
