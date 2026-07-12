import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Handles GDPR data-subject erasure requests against audit logs.
 *
 * Pseudonymizes `actorEmail` for all audit records belonging to a given user,
 * replacing the original value with `SHA-256(email + GDPR_SALT)`.
 * The audit record structure is preserved; only the PII field is replaced.
 */
@Injectable()
export class GdprRedactionService {
  private readonly logger = new Logger(GdprRedactionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Pseudonymizes `actorEmail` for all audit logs belonging to the given user.
   *
   * Uses raw SQL to bypass the Prisma immutability middleware, which blocks
   * ORM-level UPDATE operations on `audit_logs`. This is the only sanctioned
   * mutation path for GDPR erasure.
   *
   * @param userId - UUID of the user whose email must be pseudonymized.
   */
  async gdprRedact(userId: string): Promise<void> {
    const logs = await this.prisma.auditLog.findMany({
      where: { actorId: userId },
      select: { id: true, actorEmail: true },
    });

    if (logs.length === 0) return;

    const salt = this.config.get<string>('GDPR_SALT', 'default-gdpr-salt');

    for (const log of logs) {
      if (!log.actorEmail) continue;
      const pseudonym = createHash('sha256')
        .update(log.actorEmail + salt)
        .digest('hex');

      await this.prisma.$executeRaw`
        UPDATE audit_logs SET "actorEmail" = ${pseudonym} WHERE id = ${log.id}
      `;
    }

    this.logger.log(
      `GDPR redaction complete for userId=${userId}, affected=${logs.length} records`,
    );
  }
}
