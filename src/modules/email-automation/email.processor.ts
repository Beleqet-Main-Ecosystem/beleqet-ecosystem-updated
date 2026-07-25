import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EMAIL_QUEUE_NAME } from './email.service';

interface SendJobData {
  emailLogId: string;
}

/**
 * Background worker that consumes `send` jobs from the email queue,
 * renders the locale-specific Handlebars template, sends via the
 * configured mail transport, and updates the EmailLog row with the
 * outcome. Retries are handled by BullMQ's job `attempts`/`backoff`
 * config set at enqueue time in EmailService.dispatch().
 */
@Processor(EMAIL_QUEUE_NAME)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<SendJobData>): Promise<void> {
    const { emailLogId } = job.data;
    const log = await this.prisma.emailLog.findUniqueOrThrow({
      where: { id: emailLogId },
    });

    try {
      const result = await this.mailerService.sendMail({
        to: log.recipient,
        subject: log.subject,
        template: `./${log.locale}/${log.templateName}`,
        context: (log.metadata as Record<string, unknown>) ?? {},
      });

      await this.prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: EmailStatus.SENT,
          sentAt: new Date(),
          attempts: { increment: 1 },
          providerMsgId: result?.messageId ?? null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown send error';
      this.logger.error(`Failed to send email log=${log.id}: ${message}`);

      await this.prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: EmailStatus.FAILED,
          attempts: { increment: 1 },
          errorMessage: message,
        },
      });

      // Re-throw so BullMQ registers the attempt as failed and retries
      // according to the job's backoff policy.
      throw error;
    }
  }
}
