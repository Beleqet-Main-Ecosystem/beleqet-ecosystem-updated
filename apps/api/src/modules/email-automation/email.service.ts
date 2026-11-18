import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailStatus, EmailType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SendEmailDto } from './dto/send-email.dto';
import { QueryEmailLogDto } from './dto/query-email-log.dto';
import { EmailGdprService } from './email-gdpr.service';

const APP_BASE_URL = process.env.APP_BASE_URL ?? 'https://beleqet.com';

export const EMAIL_QUEUE_NAME = 'email-dispatch';

/** Maps each email type to the Handlebars template file used to render it. */
const TEMPLATE_BY_TYPE: Record<EmailType, string> = {
  WELCOME: 'welcome',
  PASSWORD_RESET: 'password-reset',
  PAYMENT_RECEIPT: 'payment-receipt',
  NEWSLETTER: 'newsletter',
};

/** Default subject lines per type, in English; localized subjects can
 * be overridden via `variables.subjectOverride` from the caller. */
const DEFAULT_SUBJECT_BY_TYPE: Record<EmailType, string> = {
  WELCOME: 'Welcome to Beleqet',
  PASSWORD_RESET: 'Reset your password',
  PAYMENT_RECEIPT: 'Your payment receipt',
  NEWSLETTER: 'Beleqet Newsletter',
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gdprService: EmailGdprService,
    @InjectQueue(EMAIL_QUEUE_NAME) private readonly emailQueue: Queue,
  ) {}

  /**
   * Creates an audit log row for the requested email and enqueues a
   * BullMQ job to actually send it. Returns the created log so callers
   * (or the controller) can report back a tracking id immediately.
   *
   * NEWSLETTER sends are checked against the GDPR/CAN-SPAM suppression
   * list first and silently skipped (logged as SUPPRESSED-equivalent via
   * a FAILED-free no-op) if the recipient has unsubscribed or requested
   * erasure. Transactional email types are never suppressed.
   */
  async dispatch(dto: SendEmailDto) {
    if (dto.type === EmailType.NEWSLETTER) {
      const suppressed = await this.gdprService.isSuppressed(dto.recipient);
      if (suppressed) {
        this.logger.log(`Skipped newsletter to ${dto.recipient} — suppressed`);
        return null;
      }
    }

    const locale = dto.locale ?? 'en';
    const templateName = TEMPLATE_BY_TYPE[dto.type];
    const variables = this.buildTemplateVariables(dto);

    const log = await this.prisma.emailLog.create({
      data: {
        recipient: dto.recipient,
        type: dto.type,
        status: EmailStatus.QUEUED,
        subject:
          (dto.variables?.subjectOverride as string | undefined) ??
          DEFAULT_SUBJECT_BY_TYPE[dto.type],
        locale,
        templateName,
        metadata: variables as Prisma.InputJsonValue,
        userId: dto.userId,
      },
    });

    await this.emailQueue.add(
      'send',
      { emailLogId: log.id },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(`Queued ${dto.type} email to ${dto.recipient} (log=${log.id})`);
    return log;
  }

  /**
   * Formats amount/currency for display and injects locale-appropriate
   * decimal/symbol placement (e.g. "$1,250.00" vs "ETB 1,250.00"), and
   * attaches a signed unsubscribe link for newsletters. This is where
   * "raw amount + currency code" becomes an actually-correct receipt.
   */
  private buildTemplateVariables(dto: SendEmailDto): Record<string, unknown> {
    const variables: Record<string, unknown> = { ...(dto.variables ?? {}) };
    const locale = dto.locale ?? 'en';

    if (
      dto.type === EmailType.PAYMENT_RECEIPT &&
      dto.currency &&
      typeof variables.amount === 'number'
    ) {
      variables.amount = new Intl.NumberFormat(locale === 'am' ? 'am-ET' : 'en-US', {
        style: 'currency',
        currency: dto.currency,
      }).format(variables.amount);
    }

    if (dto.type === EmailType.NEWSLETTER) {
      variables.unsubscribeUrl = this.gdprService.buildUnsubscribeUrl(dto.recipient, APP_BASE_URL);
    }

    return variables;
  }

  /** Re-queues a previously failed or sent email by log id (admin "resend"). */
  async resend(emailLogId: string) {
    const log = await this.prisma.emailLog.update({
      where: { id: emailLogId },
      data: { status: EmailStatus.QUEUED },
    });

    await this.emailQueue.add(
      'send',
      { emailLogId: log.id },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );

    return log;
  }

  /** Paginated, filterable list of dispatch logs for the admin dashboard. */
  async findLogs(query: QueryEmailLogDto) {
    const where: Prisma.EmailLogWhereInput = {
      status: query.status,
      type: query.type,
      recipient: query.recipient ? { contains: query.recipient, mode: 'insensitive' } : undefined,
      createdAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.emailLog.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async findLogById(id: string) {
    return this.prisma.emailLog.findUniqueOrThrow({ where: { id } });
  }
}
