import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { IAuditLogger } from '../interfaces/audit-logger.interface';

/** Writes auth security events (link attempts/successes/rejections) to the existing EventLog table. */
@Injectable()
export class PrismaAuditLogger implements IAuditLogger {
  constructor(private readonly prisma: PrismaService) {}

  public async log(
    eventType: string,
    entityId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.eventLog.create({
      data: {
        eventType,
        entityId,
        entityType: 'User',
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }
}
