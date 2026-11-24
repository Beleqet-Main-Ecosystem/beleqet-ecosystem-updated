import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { primaryFrontendUrl } from '../../../common/utils/frontend-url';
import { PrismaService } from '../../../prisma/prisma.service';
import { NOTIFICATION_JOBS, QUEUE_NAMES } from '../../platform/queues/queues.constants';
import { PushService } from '../push/push.service';
import type { TelegramPayload } from './notifications.processor';

/** The two languages the Jobs bot speaks; anything else is English. */
export type BotLanguage = 'en' | 'am';

/** What one person is told about something that happened to them. */
export interface Notice {
  /** The bell entry's kind, e.g. 'JOB_APPROVED'. */
  type: string;
  /** The bell and the app's push notification, in English like the other notifications. */
  title: string;
  body: string;
  /** Ids the app opens the right screen from (see pushPath): roomId, contractId, jobId... */
  metadata: Record<string, string>;
  /** The Jobs bot message, Markdown, with anything people typed already escaped. */
  telegram: Record<BotLanguage, string>;
  /** The button under it: a Mini App screen (miniApp, under /tg) or a website page (web). */
  button: { text: Record<BotLanguage, string>; miniApp?: string; web?: string };
}

/** The Telegram message for someone, or null without Telegram or with its notifications off. */
export function telegramNotice(
  user: {
    telegramId: string | null;
    notificationPreference: { telegramEnabled: boolean; language: string } | null;
  },
  notice: Notice,
  frontendUrl: string,
): TelegramPayload | null {
  if (!user.telegramId || user.notificationPreference?.telegramEnabled === false) return null;
  const language: BotLanguage = user.notificationPreference?.language === 'am' ? 'am' : 'en';
  const { miniApp, web } = notice.button;
  return {
    telegramId: user.telegramId,
    message: notice.telegram[language],
    button: {
      text: notice.button.text[language],
      url: `${frontendUrl}${miniApp ?? web ?? '/'}`,
      ...(miniApp ? {} : { browser: true }),
    },
  };
}

/**
 * Tells one person something that happened to them: the bell on the website and in the app, a
 * push to their phone, and a message from the Jobs bot (in their language, unless they turned
 * Telegram notifications off). Never throws: a notice that fails mustn't undo what caused it.
 */
@Injectable()
export class UserNotifier {
  private readonly logger = new Logger(UserNotifier.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly queue: Queue,
    @Optional() private readonly push?: PushService,
  ) {}

  /** The bell, a push to their phone, and Telegram. */
  async notify(userId: string, notice: Notice): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          type: notice.type,
          title: notice.title,
          body: notice.body,
          channel: 'IN_APP',
          metadata: notice.metadata,
        },
      });
      await this.push?.sendToUser(userId, {
        title: notice.title,
        body: notice.body,
        metadata: notice.metadata,
      });
    } catch (err) {
      this.logger.warn(`Notice ${notice.type} for ${userId} failed: ${(err as Error).message}`);
    }
    await this.telegram(userId, notice);
  }

  /** Telegram only, where the bell entry and the push are made already. */
  async telegram(userId: string, notice: Notice): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          telegramId: true,
          notificationPreference: { select: { telegramEnabled: true, language: true } },
        },
      });
      const frontendUrl = primaryFrontendUrl(this.config.get<string>('FRONTEND_URL'));
      const message = user && telegramNotice(user, notice, frontendUrl);
      if (message) await this.queue.add(NOTIFICATION_JOBS.SEND_TELEGRAM, message);
    } catch (err) {
      this.logger.warn(`Telegram ${notice.type} for ${userId} failed: ${(err as Error).message}`);
    }
  }
}
