import { Processor, Process } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, NOTIFICATION_JOBS } from '../queues/queues.constants';
import * as nodemailer from 'nodemailer';

interface InAppPayload {
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata?: object;
}

interface TelegramPayload {
  telegramId: string;
  message: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: this.config.get<number>('SMTP_PORT'),
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASSWORD') ?? this.config.get<string>('SMTP_PASS'),
      },
      secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
    });
  }

  @Process(NOTIFICATION_JOBS.SEND_IN_APP)
  async sendInApp(job: Job<InAppPayload>) {
    const { userId, type, title, body, metadata } = job.data;
    if (!userId) return;
    await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        channel: 'IN_APP',
        metadata: metadata as never,
      },
    });
    this.logger.debug(`In-app → ${userId}: ${title}`);
  }

  @Process(NOTIFICATION_JOBS.SEND_TELEGRAM)
  async sendTelegram(job: Job<TelegramPayload>) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) return;
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: job.data.telegramId,
          text: job.data.message,
          parse_mode: 'Markdown',
        }),
      });
      this.logger.debug(`Telegram → ${job.data.telegramId}`);
    } catch (e) {
      this.logger.warn(`Telegram failed: ${(e as Error).message}`);
    }
  }

  @Process(NOTIFICATION_JOBS.SEND_EMAIL)
  async sendEmail(job: Job<EmailPayload>) {
    const { to, subject, html, text } = job.data;
    if (!to) return;

    try {
      await this.transporter.sendMail({
        from:
          this.config.get<string>('SMTP_FROM') ??
          this.config.get<string>('EMAIL_FROM', 'Beleqet <noreply@beleqet.com>'),
        to,
        subject,
        html,
        text,
      });
      this.logger.debug(`Email → ${to}: ${subject}`);
    } catch (e) {
      this.logger.warn(`Email failed: ${(e as Error).message}`);
    }
  }
}
