import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Nullifies `ipAddress` on audit log records older than 90 days.
 *
 * Runs daily at midnight. IP addresses are personal data and must not be
 * retained indefinitely. Uses raw SQL to bypass the immutability middleware.
 */
@Injectable()
export class IpRedactionTask {
  private readonly logger = new Logger(IpRedactionTask.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Nullifies `ipAddress` on all records older than 90 days. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runIpRedaction(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const result = await this.prisma.$executeRaw`
      UPDATE audit_logs SET "ipAddress" = NULL WHERE "createdAt" < ${cutoff} AND "ipAddress" IS NOT NULL
    `;

    this.logger.log(
      `IP redaction task nullified ipAddress on ${result} audit log(s) older than 90 days`,
    );
  }
}
