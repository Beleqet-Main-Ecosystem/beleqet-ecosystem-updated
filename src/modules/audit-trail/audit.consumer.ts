import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { computeIntegrityHash } from './utils/integrity-hash.util';

/**
 * Bull queue consumer for the `audit-trail` queue.
 *
 * For each `write` job: assigns a UUID, stamps `createdAt`, computes the
 * SHA-256 integrity hash, and persists the record via Prisma.
 * Errors are rethrown so Bull retries according to the queue back-off config.
 */
@Processor(QUEUE_NAMES.AUDIT_TRAIL)
export class AuditConsumer {
  private readonly logger = new Logger(AuditConsumer.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('write')
  async handleWrite(job: Job<CreateAuditLogDto>): Promise<void> {
    const id = uuid();
    const createdAt = new Date();
    const data = job.data;

    const integrityHash = computeIntegrityHash({
      id,
      actorId: data.actorId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      createdAt,
      ipAddress: data.ipAddress,
      metadata: data.metadata,
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          id,
          actorId: data.actorId,
          actorEmail: data.actorEmail,
          actorRole: data.actorRole,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          metadata: (data.metadata ?? {}) as import('@prisma/client').Prisma.InputJsonValue,
          correlationId: data.correlationId,
          integrityHash,
          createdAt,
        },
      });
    } catch (err) {
      this.logger.error('Failed to write audit log to database', err);
      throw err;
    }
  }
}
