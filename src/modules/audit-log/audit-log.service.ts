import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { scrubPii } from './utils/pii-scrubber.util';
import { validateMultiCurrencyPayload } from './utils/multi-currency.util';

export interface PaginatedAuditLogsResponse {
  data: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Core Service managing audit logging creation, search, pagination, and GDPR data retention policies.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persists a new audit log record after applying GDPR PII scrubbing and multi-currency validations.
   *
   * @param dto - Audit log data transfer object
   * @returns Created AuditLog record
   * @security GDPR & Multi-Currency compliance enforced prior to persistence.
   */
  async createLog(dto: CreateAuditLogDto): Promise<any> {
    try {
      // 1. GDPR PII Scrubbing
      const scrubbedPrevious = dto.previousState ? (scrubPii(dto.previousState) as any) : undefined;
      let scrubbedNew = dto.newState ? (scrubPii(dto.newState) as any) : undefined;

      // 2. Multi-Currency Compliance Check
      if (dto.newState) {
        const validation = validateMultiCurrencyPayload(dto.newState);
        if (!validation.isValid) {
          this.logger.warn(`Multi-Currency warning for action ${dto.action}: ${validation.error}`);
          // Tag financial payloads missing ISO currency validation in metadata
          scrubbedNew = {
            ...scrubbedNew,
            _currencyComplianceWarning: validation.error,
          };
        }
      }

      return await this.prisma.auditLog.create({
        data: {
          userId: dto.userId || null,
          action: dto.action,
          entity: dto.entity,
          entityId: dto.entityId || null,
          previousState: scrubbedPrevious ?? undefined,
          newState: scrubbedNew ?? undefined,
          ipAddress: dto.ipAddress || null,
          userAgent: dto.userAgent || null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to record audit log entry for action ${dto.action}: ${(error as Error).message}`, (error as Error).stack);
      throw error;
    }
  }

  /**
   * Retrieves paginated audit logs.
   *
   * @param query - Query and pagination parameters
   * @returns Paginated result structure
   */
  async findAll(query: QueryAuditLogDto): Promise<PaginatedAuditLogsResponse> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.auditLog.count(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Searches audit logs based on multiple filter criteria (user_id, action, entity, date range).
   *
   * @param query - Search criteria and pagination parameters
   * @returns Filtered paginated audit logs
   */
  async searchLogs(query: QueryAuditLogDto): Promise<PaginatedAuditLogsResponse> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }

    if (query.entity) {
      where.entity = { contains: query.entity, mode: 'insensitive' };
    }

    if (query.startDate || query.endDate) {
      where.timestamp = {};
      if (query.startDate) {
        where.timestamp.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.timestamp.lte = new Date(query.endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Purges audit logs older than the specified retention window for GDPR compliance.
   *
   * @param days - Number of days to retain logs (defaults to process.env.AUDIT_LOG_RETENTION_DAYS or 90)
   * @returns Count of deleted audit log rows
   * @security GDPR Compliance: Automatically purges historical logs past retention window.
   */
  async purgeExpiredLogs(days?: number): Promise<{ count: number; retentionDays: number; cutoffDate: Date }> {
    const retentionDays = days || parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });

    this.logger.log(`Purged ${result.count} audit logs older than ${retentionDays} days (cutoff: ${cutoffDate.toISOString()})`);

    return {
      count: result.count,
      retentionDays,
      cutoffDate,
    };
  }

  /**
   * Daily midnight Cron task enforcing audit log data retention policies.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleRetentionCron(): Promise<void> {
    this.logger.log('Running daily automated audit log data retention policy purge...');
    await this.purgeExpiredLogs();
  }
}
