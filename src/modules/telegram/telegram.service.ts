import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf;
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    // If you type something like 'your_bot_token_here', don't crash
    if (token && token !== 'your_bot_token_here') {
      this.bot = new Telegraf(token);
    }
  }

  async onModuleInit() {
    if (!this.bot) {
      this.logger.warn('Valid TELEGRAM_BOT_TOKEN not provided. Telegram bot listener disabled.');
      return;
    }

    // Command: /start
    this.bot.command('start', async (ctx) => {
      const telegramId = String(ctx.from.id);
      await ctx.reply(
        `Welcome to Beleqet! Your Telegram ID is: ${telegramId}.\n\n` +
          `To receive instant notifications for your gigs, please copy this ID and save it in your Beleqet Profile Settings.`,
      );
      this.logger.log(`Telegram /start triggered by ${telegramId}`);
    });

    // Handle generic text
    this.bot.on('text', (ctx) => {
      ctx.reply(
        'I am an automated notification bot for Beleqet. Please use the main website to interact with gigs!',
      );
    });

    try {
      this.bot.launch();
      this.logger.log('Telegram bot listener started successfully.');
    } catch (err) {
      this.logger.error('Failed to start Telegram bot', (err as Error).message);
    }
  }

  onModuleDestroy() {
    if (this.bot) {
      this.bot.stop('SIGINT');
    }
  }
}
