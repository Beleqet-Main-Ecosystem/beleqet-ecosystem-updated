import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Enforces the configurable audit log retention policy.
 *
 * Runs daily at midnight. Deletes `audit_logs` records older than
 * `AUDIT_RETENTION_DAYS` env variable (default 365 days) using raw SQL
 * to bypass the Prisma immutability middleware.
 */
@Injectable()
export class RetentionTask {
  private readonly logger = new Logger(RetentionTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Deletes records older than the configured retention period. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runRetention(): Promise<void> {
    const retentionDays = this.config.get<number>('AUDIT_RETENTION_DAYS', 365);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await this.prisma.$executeRaw`
      DELETE FROM audit_logs WHERE "createdAt" < ${cutoff}
    `;

    this.logger.log(
      `Retention task deleted ${result} audit log(s) older than ${retentionDays} days`,
    );
  }
}
