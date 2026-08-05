import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import {
  AuditLogListResponse,
  AuditLogRecord,
  CreateAuditLogInput,
} from './interfaces/audit-log.interface';
import { redactAuditPayload } from './utils/gdpr-redactor.util';

/**
 * Persists and queries platform audit events stored in `events_log`.
 * All writes are GDPR-redacted before persistence.
 */
@Injectable()
export class AuditLoggingService {
  private readonly logger = new Logger(AuditLoggingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * Creates a single audit log entry with redacted payload.
   *
   * @param input - Audit event fields
   * @returns Persisted audit log record
   */
  async create(input: CreateAuditLogInput): Promise<AuditLogRecord> {
    const safePayload = redactAuditPayload(input.payload);
    const row = await this.prisma.eventLog.create({
      data: {
        eventType: input.eventType,
        entityId: input.entityId,
        entityType: input.entityType,
        payload: safePayload as Prisma.InputJsonValue,
        processedBy: input.processedBy,
        actorUserId: input.actorUserId,
        ipAddress: input.ipAddress,
        httpMethod: input.httpMethod,
        path: input.path,
        statusCode: input.statusCode,
        durationMs: input.durationMs,
      },
    });
    return this.toRecord(row);
  }

  /**
   * Fire-and-forget write used by the HTTP interceptor so request latency is unaffected.
   *
   * @param input - Audit event fields
   */
  async createSafe(input: CreateAuditLogInput): Promise<void> {
    try {
      await this.create(input);
    } catch (error) {
      this.logger.error(`Failed to write audit log: ${(error as Error).message}`);
    }
  }

  /**
   * Lists audit logs with filters, pagination, i18n message, and currency metadata.
   *
   * @param query - Admin filter / pagination / locale options
   * @returns Paginated audit log list
   */
  async findMany(query: QueryAuditLogsDto): Promise<AuditLogListResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const lang = query.lang || 'en';
    const currency = (query.currency || 'ETB').toUpperCase();
    const where = this.buildWhere(query);

    const [rows, total] = await Promise.all([
      this.prisma.eventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.eventLog.count({ where }),
    ]);

    const message = this.translate('audit-logging.LIST_SUCCESS', lang, 'Audit logs retrieved');

    return {
      data: rows.map((row) => this.enrichMonetary(this.toRecord(row), currency)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      message,
      currency,
    };
  }

  /**
   * Returns a single audit log by id.
   *
   * @param id - EventLog UUID
   * @param lang - Optional locale for error messages
   * @param currency - Display currency for monetary fields
   * @returns Audit log record
   */
  async findById(id: string, lang = 'en', currency = 'ETB'): Promise<AuditLogRecord> {
    const row = await this.prisma.eventLog.findUnique({ where: { id } });
    if (!row) {
      const message = this.translate('audit-logging.NOT_FOUND', lang, 'Audit log not found');
      throw new NotFoundException(message);
    }
    return this.enrichMonetary(this.toRecord(row), currency.toUpperCase());
  }

  /**
   * Exports filtered audit logs as JSON or CSV for GDPR / compliance use.
   *
   * @param query - Same filters as list; `format` selects json|csv
   * @returns Serialized export body and content type
   */
  async export(
    query: QueryAuditLogsDto,
  ): Promise<{ body: string; contentType: string; filename: string }> {
    const lang = query.lang || 'en';
    const currency = (query.currency || 'ETB').toUpperCase();
    const format = (query.format || 'json').toLowerCase();
    const where = this.buildWhere(query);

    const rows = await this.prisma.eventLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5_000,
    });

    const records = rows.map((row) => this.enrichMonetary(this.toRecord(row), currency));
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      return {
        body: this.toCsv(records),
        contentType: 'text/csv; charset=utf-8',
        filename: `audit-logs-${stamp}.csv`,
      };
    }

    const message = this.translate('audit-logging.EXPORT_SUCCESS', lang, 'Audit logs exported');

    return {
      body: JSON.stringify({ message, currency, data: records }, null, 2),
      contentType: 'application/json; charset=utf-8',
      filename: `audit-logs-${stamp}.json`,
    };
  }

  /**
   * Loads all EventLog rows related to a user for GDPR data export.
   *
   * @param userId - Subject user id
   * @returns Matching audit rows (payload already redacted at write time)
   */
  async findByUserForGdpr(userId: string): Promise<AuditLogRecord[]> {
    const rows = await this.prisma.eventLog.findMany({
      where: {
        OR: [{ entityId: userId }, { actorUserId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 10_000,
    });
    return rows.map((row) => this.toRecord(row));
  }

  /**
   * Builds a Prisma where clause from admin query filters.
   *
   * @param query - Filter DTO
   * @returns Prisma EventLogWhereInput
   */
  buildWhere(query: QueryAuditLogsDto): Prisma.EventLogWhereInput {
    const and: Prisma.EventLogWhereInput[] = [];

    if (query.eventType) {
      and.push({ eventType: query.eventType });
    }
    if (query.entityId) {
      and.push({ entityId: query.entityId });
    }
    if (query.entityType) {
      and.push({ entityType: query.entityType });
    }
    if (query.actorUserId) {
      and.push({ actorUserId: query.actorUserId });
    }
    if (query.httpMethod) {
      and.push({ httpMethod: query.httpMethod.toUpperCase() });
    }
    if (query.path) {
      and.push({ path: { contains: query.path, mode: 'insensitive' } });
    }
    if (query.statusCode !== undefined) {
      and.push({ statusCode: query.statusCode });
    }
    if (query.from || query.to) {
      and.push({
        createdAt: {
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lte: new Date(query.to) } : {}),
        },
      });
    }
    if (query.search) {
      const term = query.search;
      and.push({
        OR: [
          { path: { contains: term, mode: 'insensitive' } },
          { eventType: { contains: term, mode: 'insensitive' } },
          { entityId: { contains: term, mode: 'insensitive' } },
        ],
      });
    }

    return and.length > 0 ? { AND: and } : {};
  }

  /**
   * Maps a Prisma EventLog row to the API record shape.
   *
   * @param row - Prisma EventLog
   * @returns AuditLogRecord
   */
  private toRecord(row: {
    id: string;
    eventType: string;
    entityId: string;
    entityType: string;
    payload: Prisma.JsonValue;
    processedBy: string | null;
    actorUserId: string | null;
    ipAddress: string | null;
    httpMethod: string | null;
    path: string | null;
    statusCode: number | null;
    durationMs: number | null;
    createdAt: Date;
  }): AuditLogRecord {
    const payload =
      row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : { value: row.payload };

    return {
      id: row.id,
      eventType: row.eventType,
      entityId: row.entityId,
      entityType: row.entityType,
      payload,
      processedBy: row.processedBy,
      actorUserId: row.actorUserId,
      ipAddress: row.ipAddress,
      httpMethod: row.httpMethod,
      path: row.path,
      statusCode: row.statusCode,
      durationMs: row.durationMs,
      createdAt: row.createdAt,
    };
  }

  /**
   * Attaches display-currency metadata when the payload contains amount/currency fields.
   *
   * @param record - Base audit record
   * @param targetCurrency - Requested display currency
   * @returns Record with optional monetary enrichment
   */
  private enrichMonetary(record: AuditLogRecord, targetCurrency: string): AuditLogRecord {
    const amount = this.extractAmount(record.payload);
    const sourceCurrency = this.extractCurrency(record.payload) || 'ETB';

    if (amount === null) {
      return { ...record, displayCurrency: targetCurrency, amountInDisplayCurrency: null };
    }

    let converted = amount;
    try {
      converted = this.walletService.convertCurrency(amount, sourceCurrency, targetCurrency);
    } catch {
      converted = amount;
    }

    return {
      ...record,
      displayCurrency: targetCurrency,
      amountInDisplayCurrency: converted,
    };
  }

  /**
   * Extracts a numeric amount from a payload when present.
   *
   * @param payload - Audit payload
   * @returns Amount or null
   */
  private extractAmount(payload: Record<string, unknown>): number | null {
    const raw = payload.amount ?? payload.netAmount ?? payload.grossAmount;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw))) {
      return Number(raw);
    }
    return null;
  }

  /**
   * Extracts a currency code from a payload when present.
   *
   * @param payload - Audit payload
   * @returns Currency code or null
   */
  private extractCurrency(payload: Record<string, unknown>): string | null {
    const raw = payload.currency;
    return typeof raw === 'string' && raw.trim() ? raw.trim().toUpperCase() : null;
  }

  /**
   * Resolves an i18n message with a safe string fallback.
   *
   * @param key - Translation key
   * @param lang - Locale
   * @param fallback - Default English string
   * @returns Localized string
   */
  private translate(key: string, lang: string, fallback: string): string {
    const value = this.i18n.t(key, { lang, defaultValue: fallback });
    return typeof value === 'string' ? value : fallback;
  }

  /**
   * Serializes audit records to CSV.
   *
   * @param records - Audit rows
   * @returns CSV string
   */
  private toCsv(records: AuditLogRecord[]): string {
    const headers = [
      'id',
      'eventType',
      'entityId',
      'entityType',
      'actorUserId',
      'httpMethod',
      'path',
      'statusCode',
      'durationMs',
      'ipAddress',
      'processedBy',
      'createdAt',
      'displayCurrency',
      'amountInDisplayCurrency',
      'payload',
    ];

    const escape = (value: unknown): string => {
      const text = value === null || value === undefined ? '' : String(value);
      if (text.includes('"') || text.includes(',') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const lines = [headers.join(',')];
    for (const record of records) {
      lines.push(
        [
          record.id,
          record.eventType,
          record.entityId,
          record.entityType,
          record.actorUserId,
          record.httpMethod,
          record.path,
          record.statusCode,
          record.durationMs,
          record.ipAddress,
          record.processedBy,
          record.createdAt.toISOString(),
          record.displayCurrency,
          record.amountInDisplayCurrency,
          JSON.stringify(record.payload),
        ]
          .map(escape)
          .join(','),
      );
    }
    return lines.join('\n');
  }
}
