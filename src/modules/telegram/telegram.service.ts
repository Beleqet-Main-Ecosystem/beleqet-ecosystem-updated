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

  async onModuleInit() {
    if (!this.enabled || !this.bot) return;

    const webAppUrl = this.config.get<string>('TELEGRAM_WEBAPP_URL');
    if (webAppUrl && webAppUrl.startsWith('https://')) {
      try {
        await this.bot.telegram.setChatMenuButton({
          menuButton: {
            type: 'web_app',
            text: 'Launch Beleqet',
            web_app: { url: webAppUrl },
          },
        });
        this.logger.log(`Telegram chat menu button configured for WebApp: ${webAppUrl}`);
      } catch (err) {
        this.logger.warn(`Could not set WebApp chat menu button: ${(err as Error).message}`);
      }
    }

    this.bot.command('start', async (ctx) => {
      const telegramId = String(ctx.from?.id || '');
      const webApp = this.config.get<string>('TELEGRAM_WEBAPP_URL');

      // Extract optional deep-link payload (e.g., /start gig_123 or startapp parameter)
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
                    web_app: { url },
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

    this.bot.on('text', (ctx) => {
      ctx.reply(
        'I am an automated notification bot for Beleqet. Please use the main website or tap the Mini App button to interact with gigs!',
      );
    });

    const webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL');
    try {
      if (webhookUrl && webhookUrl.startsWith('https://')) {
        await this.bot.telegram.setWebhook(webhookUrl);
        this.logger.log(`Telegram bot configured in Webhook mode: ${webhookUrl}`);
      } else {
        await this.bot.telegram.deleteWebhook({ drop_pending_updates: false });
        await this.bot.launch();
        this.logger.log('Telegram bot listener started successfully in Long Polling mode.');
      }
    } catch (err) {
      this.logger.error(`Telegram bot failed to start/configure: ${(err as Error).message}`);
      this.logger.warn('Continuing without Telegram bot listener.');
      this.enabled = false;
    }
  }

  /**
   * Processes incoming Telegram webhook payloads in horizontally scaled production environments.
   */
  async handleWebhookUpdate(update: any) {
    if (!this.enabled || !this.bot) {
      return { ok: false, reason: 'Bot is disabled or uninitialized' };
    }
    await this.bot.handleUpdate(update);
    return { ok: true };
  }

  /**
   * Sends an automated push notification to a user's Telegram chat.
   * If targetPath is provided, attaches an interactive inline button pointing to the specific app screen.
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
        const fullUrl = `${webAppUrl.replace(/\/$/, '')}/${targetPath.replace(/^\//, '')}`;
        await this.bot.telegram.sendMessage(telegramId, message, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '👁️ Open in Mini App',
                  web_app: { url: fullUrl },
                },
              ],
            ],
          },
        });
      } else {
        await this.bot.telegram.sendMessage(telegramId, message);
      }
      this.logger.log(`Sent push notification to Telegram ID: ${telegramId}`);
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to send Telegram notification to ${telegramId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  onModuleDestroy() {
    if (this.bot) {
      this.bot.stop('SIGINT');
    }
  }
}
