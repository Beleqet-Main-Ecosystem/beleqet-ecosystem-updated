import { Processor, WorkerHost } from '@nestjs/bullmq'; // Pull WorkerHost and Processor
import { Logger, Injectable } from '@nestjs/common';
import { Job as BullMQJob } from 'bullmq'; // Use bullmq Job types
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, NOTIFICATION_JOBS } from '../queues/queues.constants';
import * as nodemailer from 'nodemailer';

export interface InAppPayload {
  userId: string;
  type: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface TelegramPayload {
  telegramId: string;
  message: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface PushPayload {
  userId: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
}

export interface SmsPayload {
  to: string;
  message: string;
}

export type NotificationJobPayloadMap = {
  [NOTIFICATION_JOBS.SEND_IN_APP]: InAppPayload;
  [NOTIFICATION_JOBS.SEND_TELEGRAM]: TelegramPayload;
  [NOTIFICATION_JOBS.SEND_EMAIL]: EmailPayload;
  [NOTIFICATION_JOBS.SEND_PUSH]: PushPayload;
  [NOTIFICATION_JOBS.SEND_SMS]: SmsPayload;
};

export type NotificationJobName = keyof NotificationJobPayloadMap;

export type NotificationJob<K extends NotificationJobName = NotificationJobName> = BullMQJob<
  NotificationJobPayloadMap[K],
  void,
  K
>;

@Injectable()
@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    super();
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

  /**
   * Router method for processing incoming notification jobs from BullMQ queue.
   *
   * @param job Strongly-typed BullMQ notification job.
   */
  async process(job: NotificationJob): Promise<void> {
    switch (job.name) {
      case NOTIFICATION_JOBS.SEND_IN_APP:
        await this.sendInApp(job as BullMQJob<InAppPayload, void, typeof NOTIFICATION_JOBS.SEND_IN_APP>);
        break;
      case NOTIFICATION_JOBS.SEND_TELEGRAM:
        await this.sendTelegram(job as BullMQJob<TelegramPayload, void, typeof NOTIFICATION_JOBS.SEND_TELEGRAM>);
        break;
      case NOTIFICATION_JOBS.SEND_EMAIL:
        await this.sendEmail(job as BullMQJob<EmailPayload, void, typeof NOTIFICATION_JOBS.SEND_EMAIL>);
        break;
      case NOTIFICATION_JOBS.SEND_PUSH:
        await this.sendPush(job as BullMQJob<PushPayload, void, typeof NOTIFICATION_JOBS.SEND_PUSH>);
        break;
      case NOTIFICATION_JOBS.SEND_SMS:
        await this.sendSms(job as BullMQJob<SmsPayload, void, typeof NOTIFICATION_JOBS.SEND_SMS>);
        break;
      default:
        this.logger.warn(`Unhandled job type context: ${(job as BullMQJob).name}`);
    }
  }

  /**
   * Handles in-app notification creation by inserting a record in the database.
   *
   * @param job Job containing InAppPayload.
   */
  async sendInApp(job: BullMQJob<InAppPayload>): Promise<void> {
    const { userId, type, title, body, metadata } = job.data;
    if (!userId) return;
    await this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        channel: 'IN_APP',
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
    this.logger.debug(`In-app → ${userId}: ${title}`);
  }

  /**
   * Handles Telegram message delivery via Telegram Bot HTTP API.
   *
   * @param job Job containing TelegramPayload.
   */
  async sendTelegram(job: BullMQJob<TelegramPayload>): Promise<void> {
    const telegramEnabled = this.config.get<string>('TELEGRAM_ENABLED', 'false');
    if (telegramEnabled !== 'true') return;
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

  /**
   * Handles Email notification dispatch using SMTP transporter.
   *
   * @param job Job containing EmailPayload.
   */
  async sendEmail(job: BullMQJob<EmailPayload>): Promise<void> {
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

  /**
   * Handles Push notification dispatch (Clean structure ready for Push provider integration).
   *
   * @param job Job containing PushPayload.
   */
  async sendPush(job: BullMQJob<PushPayload>): Promise<void> {
    const { userId, title, body } = job.data;
    if (!userId) return;
    this.logger.debug(`Push notification queued for user ${userId}: ${title} - ${body}`);
  }

  /**
   * Handles SMS notification dispatch (Clean structure ready for SMS provider integration).
   *
   * @param job Job containing SmsPayload.
   */
  async sendSms(job: BullMQJob<SmsPayload>): Promise<void> {
    const { to, message } = job.data;
    if (!to) return;
    this.logger.debug(`SMS notification queued for ${to}: ${message}`);
  }
}