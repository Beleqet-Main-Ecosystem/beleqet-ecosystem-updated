import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma, AuditLog } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AuditQueryDto } from './dto/audit-query.dto';
import { AuditLogDetailDto, PaginatedResult, AuditStatsDto } from './dto/audit-log-detail.dto';
import { computeIntegrityHash } from './utils/integrity-hash.util';

const MAX_METADATA_BYTES = 64 * 1024;
const MAX_EXPORT_ROWS = 10_000;

/**
 * Handles all audit log write and query operations.
 *
 * Write operations are fire-and-forget — all exceptions are caught internally
 * so audit failures never propagate to the caller.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.AUDIT_TRAIL) private readonly auditQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enqueues an audit log entry for asynchronous persistence.
   * Never throws — queue and metadata errors are caught and logged internally.
   */
  async log(entry: CreateAuditLogDto): Promise<void> {
    try {
      let metadata = entry.metadata;
      if (metadata) {
        const serialized = JSON.stringify(metadata);
        if (Buffer.byteLength(serialized, 'utf8') > MAX_METADATA_BYTES) {
          this.logger.warn('Audit metadata exceeds 64 KB, truncating');
          metadata = { _truncated: true };
        }
      }
      await this.auditQueue.add('write', { ...entry, metadata });
    } catch (err) {
      this.logger.error('Failed to enqueue audit log entry', err);
    }
  }

  /**
   * Masks an email address for GDPR-safe storage.
   *
   * Returns the first 3 characters of the local part followed by `***@domain`.
   *
   * @param email - A valid email address string.
   * @returns The masked representation, e.g. `"joh***@example.com"`.
   */
  maskEmail(email: string): string {
    const atIndex = email.indexOf('@');
    if (atIndex < 0) return `${email.slice(0, 3)}***`;
    const local = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);
    const prefix = local.length >= 3 ? local.slice(0, 3) : local;
    return `${prefix}***@${domain}`;
  }

  /**
   * Queries audit logs with server-side filtering and offset pagination.
   *
   * @param filters - Validated query parameters.
   * @returns A paginated result envelope. `totalPages = ceil(total/limit)`.
   */
  async query(filters: AuditQueryDto): Promise<PaginatedResult<AuditLog>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.buildWhere(filters);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Fetches a single audit log by ID and appends an integrity check result.
   *
   * @throws NotFoundException when no record with the given ID exists.
   */
  async findOne(id: string): Promise<AuditLogDetailDto> {
    const record = await this.prisma.auditLog.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`AuditLog ${id} not found`);
    const integrityValid = await this.verifyIntegrity(id);
    return { ...record, integrityValid };
  }

  /**
   * Recomputes the SHA-256 hash for a stored record and compares it against
   * the persisted value. Logs a critical ERROR on mismatch.
   *
   * @returns `true` when hashes match; `false` on mismatch or record not found.
   */
  async verifyIntegrity(logId: string): Promise<boolean> {
    const record = await this.prisma.auditLog.findUnique({ where: { id: logId } });
    if (!record) return false;

    const recomputed = computeIntegrityHash({
      id: record.id,
      actorId: record.actorId,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      createdAt: record.createdAt,
      ipAddress: record.ipAddress,
      metadata: record.metadata as Record<string, unknown>,
    });

    if (recomputed !== record.integrityHash) {
      this.logger.error(
        `Integrity mismatch for AuditLog ${logId}: stored=${record.integrityHash}, computed=${recomputed}`,
      );
      return false;
    }
    return true;
  }

  /**
   * Returns aggregate action-type counts for a given date range.
   *
   * @param fromDate - Start of the window (inclusive).
   * @param toDate   - End of the window (inclusive).
   */
  async getStats(fromDate: Date, toDate: Date): Promise<AuditStatsDto[]> {
    const groups = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: { createdAt: { gte: fromDate, lte: toDate } },
      _count: { action: true },
    });
    return groups.map((g) => ({ action: g.action, count: g._count.action }));
  }

  /**
   * Exports filtered audit logs as a CSV string, capped at 10 000 rows.
   * Commas, double-quotes, and newlines inside field values are RFC 4180 escaped.
   */
  async exportCsv(filters: AuditQueryDto): Promise<string> {
    const where = this.buildWhere(filters);
    const records = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    });

    const header = [
      'id',
      'actorId',
      'actorEmail',
      'actorRole',
      'action',
      'entityType',
      'entityId',
      'ipAddress',
      'userAgent',
      'metadata',
      'integrityHash',
      'correlationId',
      'createdAt',
    ].join(',');

    const rows = records.map((r) =>
      [
        r.id,
        r.actorId ?? '',
        r.actorEmail ?? '',
        r.actorRole ?? '',
        r.action,
        r.entityType,
        r.entityId ?? '',
        r.ipAddress ?? '',
        this.escapeCsv(r.userAgent ?? ''),
        this.escapeCsv(JSON.stringify(r.metadata)),
        r.integrityHash,
        r.correlationId ?? '',
        r.createdAt.toISOString(),
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  /** Maximum number of rows returned by `exportCsv`. */
  get exportMaxRows(): number {
    return MAX_EXPORT_ROWS;
  }

  /**
   * Returns the count of records matching the export filters.
   * Used by the controller to decide whether to set `X-Truncated: true`.
   */
  async countExport(filters: AuditQueryDto): Promise<number> {
    return this.prisma.auditLog.count({ where: this.buildWhere(filters) });
  }

  private buildWhere(filters: AuditQueryDto): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.action) where.action = filters.action;
    if (filters.actorId) where.actorId = filters.actorId;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.ipAddress) where.ipAddress = filters.ipAddress;

    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) where.createdAt.gte = new Date(filters.fromDate);
      if (filters.toDate) where.createdAt.lte = new Date(filters.toDate);
    }

    if (filters.search) {
      where.OR = [
        { actorEmail: { contains: filters.search, mode: 'insensitive' } },
        { action: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
