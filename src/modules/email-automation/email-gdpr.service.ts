import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHmac } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

/** How long to keep email logs before anonymizing them (GDPR data-minimization). */
const RETENTION_DAYS = 365;

@Injectable()
export class EmailGdprService {
  private readonly logger = new Logger(EmailGdprService.name);
  private readonly unsubscribeSecret = process.env.UNSUBSCRIBE_SECRET ?? 'change-me-in-env';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Signed, stateless unsubscribe link: no token storage needed, and it
   * can't be forged without the server secret. Embedded in every
   * NEWSLETTER template as {{unsubscribeUrl}}.
   */
  buildUnsubscribeUrl(recipient: string, baseUrl: string): string {
    const token = createHmac('sha256', this.unsubscribeSecret).update(recipient).digest('hex');
    return `${baseUrl}/email/unsubscribe?recipient=${encodeURIComponent(recipient)}&token=${token}`;
  }

  verifyUnsubscribeToken(recipient: string, token: string): boolean {
    const expected = createHmac('sha256', this.unsubscribeSecret).update(recipient).digest('hex');
    return expected === token;
  }

  /** Adds a recipient to the suppression list — checked before every NEWSLETTER send. */
  async suppress(recipient: string, reason: 'unsubscribed' | 'gdpr_erasure' | 'bounced') {
    await this.prisma.emailSuppression.upsert({
      where: { recipient },
      create: { recipient, reason },
      update: { reason },
    });
  }

  async isSuppressed(recipient: string): Promise<boolean> {
    const row = await this.prisma.emailSuppression.findUnique({ where: { recipient } });
    return Boolean(row);
  }

  /**
   * GDPR "right to erasure" for a user: suppresses future marketing email
   * and anonymizes their historical logs while preserving the audit trail
   * (dispatch counts, error rates) needed for operational monitoring.
   */
  async eraseUserData(userId: string, recipientEmail: string) {
    await this.suppress(recipientEmail, 'gdpr_erasure');

    await this.prisma.emailLog.updateMany({
      where: { userId },
      data: {
        recipient: `erased-${userId}@anonymized.local`,
        metadata: {},
        userId: null,
      },
    });

    this.logger.log(`Erased email data for user ${userId}`);
  }

  /**
   * Nightly job: anonymizes logs past the retention window rather than
   * deleting them outright, so dispatch-rate/failure-rate dashboards
   * still work on historical data without holding onto PII indefinitely.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredLogs() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const result = await this.prisma.emailLog.updateMany({
      where: { createdAt: { lt: cutoff }, recipient: { not: { startsWith: 'erased-' } } },
      data: { recipient: 'retention-expired@anonymized.local', metadata: {} },
    });

    if (result.count > 0) {
      this.logger.log(`Anonymized ${result.count} email logs past ${RETENTION_DAYS}-day retention`);
    }
  }
}
