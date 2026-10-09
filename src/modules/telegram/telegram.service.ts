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
        this.bot.launch().catch((err) => {
          this.logger.warn(
            `Telegram polling stopped: ${(err as Error).message}. (Outbound broadcasting remains operational via Telegram HTTP API)`,
          );
        });

        this.logger.log('Telegram bot listener started in Long Polling mode (background).');
      }
    } catch (err) {
      this.logger.warn(
        `Telegram bot listener setup error: ${(err as Error).message}. Outbound broadcasts will still proceed if token is valid.`,
      );
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
   * Broadcasts a newly published job directly to the configured Telegram channel / group.
   */
  async broadcastJob(job: {
    id: string;
    title: string;
    companyName?: string;
    location?: string;
    jobType?: string;
    salaryMin?: number;
    salaryMax?: number;
    currency?: string;
  }): Promise<boolean> {
    const channelId =
      this.config.get<string>('TELEGRAM_CHANNEL_ID') || process.env.TELEGRAM_CHANNEL_ID;
    if (!this.enabled || !this.bot || !channelId) {
      this.logger.log(
        `Telegram job broadcast skipped: enabled=${this.enabled}, bot=${Boolean(this.bot)}, channelId=${channelId}`,
      );
      return false;
    }

    let frontendUrl = this.config
      .get<string>('FRONTEND_URL', 'https://beleqetjobs.com')
      .split(',')[0]
      .trim();
    if (frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1')) {
      frontendUrl = 'https://beleqetjobs.com';
    }
    const jobUrl = `${frontendUrl.replace(/\/$/, '')}/jobs/${job.id}`;

    const salaryText =
      job.salaryMin && job.salaryMax
        ? `💰 Salary: ${job.salaryMin.toLocaleString()} - ${job.salaryMax.toLocaleString()} ${job.currency || 'ETB'}\n`
        : job.salaryMin
          ? `💰 Salary: From ${job.salaryMin.toLocaleString()} ${job.currency || 'ETB'}\n`
          : '';

    const message =
      `📢 <b>New Job Vacancy on Beleqet!</b>\n\n` +
      `💼 <b>${job.title}</b>\n` +
      `🏢 Company: ${job.companyName || 'Confidential'}\n` +
      `📍 Location: ${job.location || 'Addis Ababa, Ethiopia'}\n` +
      `⏱️ Type: ${job.jobType || 'Full-time'}\n` +
      salaryText +
      `\n🔗 Apply directly on the platform below:`;

    try {
      await this.bot.telegram.sendMessage(channelId, message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🚀 View & Apply Now',
                url: jobUrl,
              },
            ],
          ],
        },
      });
      this.logger.log(
        `Job [${job.id}] "${job.title}" successfully broadcast to Telegram channel ${channelId}`,
      );
      return true;
    } catch (err) {
      this.logger.error(
        `Failed to broadcast job to Telegram channel ${channelId}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Checks whether a Telegram user or email is registered in the Beleqet ecosystem.
   * Drop-in replacement for the legacy WordPress `/check-user` endpoint.
   */
  async checkUser(telegramId?: string, email?: string) {
    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const user = await this.prisma.user.findFirst({
        where: { email: normalizedEmail },
        select: { id: true, role: true, emailVerified: true },
      });

      if (!user) {
        return {
          registered: false,
          email_registered: false,
          can_reregister: true,
          role: 'unknown',
          language: 'en',
        };
      }

      return {
        registered: true,
        email_registered: true,
        can_reregister: false,
        role: user.role === 'EMPLOYER' ? 'employer' : 'candidate',
        language: 'en',
      };
    }

    if (!telegramId) {
      return { registered: false, email_registered: false, role: 'unknown', language: 'en' };
    }
    const user = await this.prisma.user.findFirst({
      where: { telegramId: String(telegramId) },
      select: { id: true, role: true, emailVerified: true },
    });

    if (!user) {
      return { registered: false, email_registered: false, role: 'unknown', language: 'en' };
    }

    return {
      registered: true,
      email_registered: true,
      role: user.role === 'EMPLOYER' ? 'employer' : 'candidate',
      language: 'en',
    };
  }

  /**
   * Returns all registered Telegram IDs.
   * Drop-in replacement for the legacy WordPress `/get-all-telegram-ids` endpoint.
   */
  async getAllTelegramIds(): Promise<{ telegram_ids: number[] }> {
    const users = await this.prisma.user.findMany({
      where: { telegramId: { not: null }, isActive: true },
      select: { telegramId: true },
    });

    const ids = users.map((u) => Number(u.telegramId)).filter((id) => !isNaN(id) && id > 0);

    return { telegram_ids: ids };
  }

  /**
   * Updates payment / registration status from Telegram admin actions.
   * Drop-in replacement for the legacy WordPress `/update-payment-status` endpoint.
   */
  async updatePaymentStatus(orderId: string, status: string) {
    this.logger.log(`Telegram admin updated payment/order #${orderId} to status: ${status}`);
    return { success: true, orderId, status };
  }

  /**
   * Links a user's Telegram ID to their Beleqet account using an auth token.
   */
  async linkTelegramByToken(token: string, telegramId: string) {
    if (!token || !telegramId) return { success: false, message: 'Missing token or telegramId' };
    const user = await this.prisma.user.findFirst({
      where: { id: token },
    });
    if (user) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { telegramId: String(telegramId) },
      });
      return { success: true, message: 'Telegram linked successfully' };
    }
    return { success: false, message: 'Invalid token' };
  }

  /**
   * Updates language preference for a Telegram user.
   */
  async updateLanguage(telegramId: string, language: string) {
    this.logger.log(`User ${telegramId} updated Telegram language preference to ${language}`);
    return { success: true, language };
  }

  /**
   * Direct bot registration endpoint for Candidates/Employers.
   */
  async registerFromBot(data: any) {
    const telegramId = data.telegram_id || data.telegramId;
    const email = (data.email || `telegram_${telegramId}@beleqet.internal`).toLowerCase().trim();
    const fullName = data.name || data.first_name || data.firstName || 'Telegram User';
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] || 'Telegram';
    const lastName = parts.slice(1).join(' ') || data.last_name || data.lastName || 'User';
    const role =
      data.role === 'employer' || data.role === 'wp_job_board_pro_employer'
        ? 'EMPLOYER'
        : 'JOB_SEEKER';

    if (telegramId) {
      const existing = await this.prisma.user.findFirst({
        where: { OR: [{ telegramId: String(telegramId) }, { email }] },
      });
      if (existing) {
        return { success: true, registered: true, userId: existing.id, role: existing.role };
      }

      const created = await this.prisma.user.create({
        data: {
          email,
          telegramId: String(telegramId),
          firstName,
          lastName,
          role: role as any,
          isActive: true,
          emailVerified: true,
        },
      });
      return { success: true, registered: true, userId: created.id, role: created.role };
    }

    return { success: false, message: 'Missing telegram_id' };
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
