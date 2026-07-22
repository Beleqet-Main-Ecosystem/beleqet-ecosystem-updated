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

    this.bot.command('start', async (ctx) => {
      const telegramId = String(ctx.from.id);
      await ctx.reply(
        `Welcome to Beleqet! Your Telegram ID is: ${telegramId}.\n\n` +
        `To receive instant notifications for your gigs, please copy this ID and save it in your Beleqet Profile Settings.`
      );
      this.logger.log(`Telegram /start triggered by ${telegramId}`);
    });

    this.bot.on('text', (ctx) => {
      ctx.reply('I am an automated notification bot for Beleqet. Please use the main website to interact with gigs!');
    });

    try {
      await this.bot.launch();
      this.logger.log('Telegram bot listener started successfully.');
    } catch (err) {
      this.logger.error(`Telegram bot failed to start: ${(err as Error).message}`);
      this.logger.warn('Continuing without Telegram bot listener.');
      this.enabled = false;
    }
  }

  onModuleDestroy() {
    if (this.bot) {
      this.bot.stop('SIGINT');
    }
  }
}
