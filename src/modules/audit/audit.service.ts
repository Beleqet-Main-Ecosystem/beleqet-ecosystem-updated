import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IAuditLogger } from '../../common/interfaces/audit-logger.interface';
import { sanitizePayload } from '../../common/utils/sanitize-payload.util';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

/**
 * Central write + read service for the platform's immutable audit trail.
 *
 * Writes go to the existing `events_log` table (append-only, enforced by
 * a DB trigger — see prisma/migrations/*_audit_log_immutability). Reads
 * are exposed only to admins via `AuditController`.
 *
 * Implements the shared `IAuditLogger` interface so existing callers
 * (e.g. the auth module's account-linking flow) can depend on the
 * interface rather than this concrete class (Dependency Inversion).
 */
@Injectable()
export class AuditService implements IAuditLogger {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a generic audit event. Payload is GDPR-sanitized before
   * being persisted — see `sanitizePayload`.
   */
  public async log(
    eventType: string,
    entityId: string,
    payload: Record<string, unknown>,
    entityType = 'User',
  ): Promise<void> {
    await this.prisma.eventLog.create({
      data: {
        eventType,
        entityId,
        entityType,
        payload: sanitizePayload(payload) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Records a payment/transaction-related audit event. Enforces that
   * `amount` is always paired with an ISO 4217 `currency` code, matching
   * the multi-currency convention used across the rest of the schema.
   */
  public async logPaymentTransaction(
    entityId: string,
    eventType: string,
    amount: number,
    currency: string,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await this.log(eventType, entityId, { amount, currency, ...extra }, 'Payment');
  }

  /**
   * Records an authentication event (login/logout/failed attempt).
   */
  public async logAuthEvent(
    userId: string,
    eventType: 'USER_LOGIN' | 'USER_LOGOUT' | 'USER_LOGIN_FAILED',
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await this.log(eventType, userId, extra, 'User');
  }

  /**
   * Returns a paginated, filterable slice of the audit trail for the
   * admin dashboard. Never exposes update/delete — read-only by design.
   */
  public async findAll(query: QueryAuditLogDto) {
    const page = Number(query.page) || 1;
    const limit = Math.min(Number(query.limit) || 25, 100);

    const where: Prisma.EventLogWhereInput = {};
    if (query.eventType) where.eventType = { contains: query.eventType, mode: 'insensitive' };
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.eventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.eventLog.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
