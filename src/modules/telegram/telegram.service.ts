import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf;
  private enabled = false;
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const telegramEnabled = this.config.get<string>('TELEGRAM_ENABLED', 'false');
    if (telegramEnabled !== 'true') {
      this.logger.log('TELEGRAM_ENABLED is not true. Telegram bot listener disabled.');
      return;
    }

    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');

    if (!token || token === 'your_bot_token_here') {
      this.logger.warn('Valid TELEGRAM_BOT_TOKEN not provided. Telegram bot listener disabled.');
      return;
    }

    this.bot = new Telegraf(token);
    this.enabled = true;
  }

  /**
   * Prevent Telegram network operations from hanging indefinitely.
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operation: string,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }

  async onModuleInit() {
    if (!this.enabled || !this.bot) return;

    const webAppUrl = this.config.get<string>('TELEGRAM_WEBAPP_URL');

    /**
     * Configure Telegram Mini App menu button.
     *
     * Timeout is important because Telegram must never be allowed
     * to block the NestJS application startup indefinitely.
     */
    if (webAppUrl && webAppUrl.startsWith('https://')) {
      try {
        await this.withTimeout(
          this.bot.telegram.setChatMenuButton({
            menuButton: {
              type: 'web_app',
              text: 'Launch Beleqet',
              web_app: {
                url: webAppUrl,
              },
            },
          }),
          10000,
          'Telegram setChatMenuButton',
        );

        this.logger.log(`Telegram chat menu button configured for WebApp: ${webAppUrl}`);
      } catch (err) {
        this.logger.warn(`Could not set WebApp chat menu button: ${(err as Error).message}`);
      }
    }

    /**
     * /start command.
     */
    this.bot.command('start', async (ctx) => {
      const telegramId = String(ctx.from?.id || '');
      const webApp = this.config.get<string>('TELEGRAM_WEBAPP_URL');

      // Extract optional deep-link payload
      // Example: /start gig_123
      const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : '';

      const parts = messageText.split(' ');
      const startParam = parts.length > 1 ? parts[1].trim() : '';

      if (webApp && webApp.startsWith('https://')) {
        const url = startParam ? `${webApp}?start_param=${encodeURIComponent(startParam)}` : webApp;

        await ctx.reply(
          `Welcome to Beleqet! Tap the button below to launch our interactive Mini App directly inside Telegram:\n\n` +
            `Your Telegram ID (${telegramId}) will be securely linked to your Beleqet profile.` +
            (startParam ? `\n\n🎯 Deep Link Target: ${startParam}` : ''),
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🚀 Launch Beleqet Mini App',
                    web_app: {
                      url,
                    },
                  },
                ],
              ],
            },
          },
        );
      } else {
        await ctx.reply(
          `Welcome to Beleqet! Your Telegram ID is: ${telegramId}.\n\n` +
            `To receive instant notifications for your gigs, please copy this ID and save it in your Beleqet Profile Settings.`,
        );
      }

      this.logger.log(`Telegram /start triggered by ${telegramId}`);
    });

    /**
     * Handle normal text messages.
     */
    this.bot.on('text', (ctx) => {
      ctx.reply(
        'I am an automated notification bot for Beleqet. Please use the main website or tap the Mini App button to interact with gigs!',
      );
    });

    /**
     * Configure Telegram webhook or long polling.
     */
    const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL');

    try {
      if (webhookUrl && webhookUrl.startsWith('https://')) {
        /**
         * WEBHOOK MODE
         */
        await this.withTimeout(
          this.bot.telegram.setWebhook(webhookUrl),
          10000,
          'Telegram setWebhook',
        );

        this.logger.log(`Telegram bot configured in Webhook mode: ${webhookUrl}`);
      } else {
        /**
         * LONG POLLING MODE
         */

        await this.withTimeout(
          this.bot.telegram.deleteWebhook({
            drop_pending_updates: false,
          }),
          10000,
          'Telegram deleteWebhook',
        );

        this.logger.log('Telegram deleteWebhook completed successfully.');

        // bot.launch() only resolves when the bot stops polling, so it
        // must never be awaited here — doing so blocks NestJS startup
        // (this caused a production outage on 2026-09-28).
        this.bot.launch().catch((err) => {
          this.logger.error(`Telegram polling stopped unexpectedly: ${(err as Error).message}`);
          this.enabled = false;
        });

        this.logger.log('Telegram bot listener starting in Long Polling mode (background).');
      }
    } catch (err) {
      this.logger.error(`Telegram bot failed to start/configure: ${(err as Error).message}`);

      this.logger.warn('Continuing without Telegram bot listener.');

      this.enabled = false;
    }
  }

  /**
   * Processes incoming Telegram webhook payloads
   * in horizontally scaled production environments.
   */
  async handleWebhookUpdate(update: any) {
    if (!this.enabled || !this.bot) {
      return {
        ok: false,
        reason: 'Bot is disabled or uninitialized',
      };
    }

    await this.bot.handleUpdate(update);

    return {
      ok: true,
    };
  }

  /**
   * Sends an automated push notification to a user's Telegram chat.
   *
   * If targetPath is provided, attaches an interactive
   * inline button pointing to the specific app screen.
   */
  async sendNotification(
    telegramId: string,
    message: string,
    targetPath?: string,
  ): Promise<boolean> {
    if (!this.enabled || !this.bot) {
      this.logger.warn(`Cannot send Telegram notification to ${telegramId}: bot is disabled.`);

      return false;
    }

    const webAppUrl = this.config.get<string>('TELEGRAM_WEBAPP_URL');

    try {
      if (targetPath && webAppUrl && webAppUrl.startsWith('https://')) {
        const fullUrl = `${webAppUrl.replace(/\/$/, '')}/` + `${targetPath.replace(/^\//, '')}`;

        await this.bot.telegram.sendMessage(telegramId, message, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '👁️ Open in Mini App',
                  web_app: {
                    url: fullUrl,
                  },
                },
              ],
            ],
          },
        });
      } else {
        await this.bot.telegram.sendMessage(telegramId, message);
      }

      return true;
    } catch (err) {
      this.logger.error(
        `Failed to send Telegram notification to ${telegramId}: ${(err as Error).message}`,
      );

      return false;
    }
  }

  /**
   * Gracefully stop the Telegram bot when NestJS shuts down.
   */
  async onModuleDestroy() {
    if (!this.enabled || !this.bot) {
      return;
    }

    try {
      this.bot.stop('NestJS application shutting down');
      this.logger.log('Telegram bot stopped.');
    } catch (err) {
      this.logger.warn(`Failed to stop Telegram bot cleanly: ${(err as Error).message}`);
    }
  }
}
