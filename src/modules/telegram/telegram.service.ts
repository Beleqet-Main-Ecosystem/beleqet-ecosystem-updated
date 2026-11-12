import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Telegraf } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { isDeliverableEmail } from '../../common/utils/deliverable-email';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_CODE_EVENT = 'telegram.email_code';
const EMAIL_CODES_PER_DAY = 5;

/** Text for a Telegram message sent with parse_mode HTML. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A trimmed string from a bot field, or '' (bots send numbers, nulls and blanks too). */
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 200) : '';
}

/** A Telegram username without the "@", or null when there is none. */
function telegramUsername(value: unknown): string | null {
  const name = text(value).replace(/^@+/, '');
  return /^[A-Za-z0-9_]{4,32}$/.test(name) ? name : null;
}

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private bot: Telegraf;
  private enabled = false;
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private auth: AuthService,
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

    /**
     * Receiving messages is opt-in. Telegram delivers a bot's updates to one program only, and in
     * production @BeleqetNotifyBot's conversations belong to the Python bot service; polling from
     * here knocked it offline and replaced its menu button on every API restart. Sending (channel
     * posts, user notifications) and Mini App sign-in work either way.
     */
    if (this.config.get<string>('TELEGRAM_RECEIVE_UPDATES', 'false') !== 'true') {
      this.logger.log('Telegram running send-only (TELEGRAM_RECEIVE_UPDATES is not true).');
      return;
    }

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
   * Tells the admins' private chat (TELEGRAM_ALERT_CHAT_ID) that a job is waiting for approval.
   * Never the public channel. Without an alert chat, admins see it in the admin panel only.
   */
  async notifyReviewers(job: { title: string; companyName?: string }): Promise<boolean> {
    const chatId = this.config.get<string>('TELEGRAM_ALERT_CHAT_ID');
    if (!this.enabled || !this.bot || !chatId) return false;
    const admin = (this.config.get<string>('ADMIN_URL') || 'https://admin.beleqetjobs.com').replace(
      /\/+$/,
      '',
    );
    const message =
      `🆕 <b>Job waiting for approval</b>\n\n` +
      `💼 ${escapeHtml(job.title)}\n` +
      `🏢 ${escapeHtml(job.companyName || 'Unknown company')}\n\n` +
      `Approve or reject it in the admin panel: ${admin}/listings`;
    try {
      await this.withTimeout(
        this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'HTML' }),
        10_000,
        'Review alert',
      );
      return true;
    } catch (err) {
      this.logger.error(`Failed to alert reviewers: ${(err as Error).message}`);
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

    // Employers type these; an unescaped "<" or "&" makes Telegram refuse the whole message.
    const message =
      `📢 <b>New Job Vacancy on Beleqet!</b>\n\n` +
      `💼 <b>${escapeHtml(job.title)}</b>\n` +
      `🏢 Company: ${escapeHtml(job.companyName || 'Confidential')}\n` +
      `📍 Location: ${escapeHtml(job.location || 'Addis Ababa, Ethiopia')}\n` +
      `⏱️ Type: ${escapeHtml(job.jobType || 'Full-time')}\n` +
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
      select: {
        id: true,
        role: true,
        email: true,
        emailVerified: true,
        notificationPreference: { select: { language: true } },
      },
    });

    if (!user) {
      return { registered: false, email_registered: false, role: 'unknown', language: 'en' };
    }

    const hasEmail = isDeliverableEmail(user.email);
    return {
      registered: true,
      email_registered: true,
      role: user.role === 'EMPLOYER' ? 'employer' : 'candidate',
      // Employers no longer wait for approval to use the bot; their jobs are reviewed instead.
      status: 'approved',
      language: user.notificationPreference?.language === 'am' ? 'am' : 'en',
      // Posting jobs needs a confirmed, real email (Telegram sign-ups add one in the bot).
      has_email: hasEmail,
      email: hasEmail ? user.email : null,
      email_confirmed: hasEmail && user.emailVerified,
    };
  }

  /**
   * Emails a 6-digit code so a bot user can confirm their email (employers, before posting).
   * With `email`, first sets that address: a Telegram sign-up adding one, or a typo being fixed.
   * A confirmed address isn't changed here. At most one code a minute and five a day.
   */
  async requestEmailCode(telegramId: string, email?: string) {
    const user = await this.botUser(telegramId);
    let address = user.email;
    const wanted = typeof email === 'string' ? email.toLowerCase().trim() : '';
    if (wanted && wanted !== user.email) {
      if (!EMAIL_PATTERN.test(wanted) || !isDeliverableEmail(wanted)) {
        throw new BadRequestException('That does not look like an email address.');
      }
      if (user.emailVerified && isDeliverableEmail(user.email)) {
        throw new ConflictException(`Your email ${user.email} is already confirmed.`);
      }
      const taken = await this.prisma.user.findUnique({
        where: { email: wanted },
        select: { id: true },
      });
      if (taken) {
        throw new ConflictException('That email belongs to another account. Use a different one.');
      }
      await this.prisma.user.update({
        where: { id: user.id },
        data: { email: wanted, emailVerified: false },
      });
      address = wanted;
    } else if (user.emailVerified && isDeliverableEmail(user.email)) {
      return { sent: false, already_confirmed: true, email: user.email };
    }
    if (!isDeliverableEmail(address)) {
      throw new BadRequestException('Send your email address first.');
    }

    const sentToday = await this.prisma.eventLog.count({
      where: {
        eventType: EMAIL_CODE_EVENT,
        entityId: user.id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (sentToday >= EMAIL_CODES_PER_DAY) {
      throw new HttpException(
        'You asked for too many codes today. Try again tomorrow.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (!(await this.auth.sendEmailCodeTo(user.id))) {
      throw new HttpException(
        'We sent you a code less than a minute ago. Wait a minute, then ask again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.prisma.eventLog.create({
      data: { eventType: EMAIL_CODE_EVENT, entityId: user.id, entityType: 'User', payload: {} },
    });
    return { sent: true, already_confirmed: false, email: address };
  }

  /** Checks the 6-digit code a bot user typed and confirms their email. */
  async confirmEmailCode(telegramId: string, code: string) {
    const user = await this.botUser(telegramId);
    await this.auth.confirmEmailCode(user.id, code);
    return { confirmed: true, email: user.email };
  }

  private async botUser(telegramId: string) {
    const user = telegramId
      ? await this.prisma.user.findUnique({
          where: { telegramId: String(telegramId) },
          select: { id: true, email: true, emailVerified: true, isActive: true },
        })
      : null;
    if (!user || !user.isActive) {
      throw new NotFoundException('This Telegram account is not registered. Send /start.');
    }
    return user;
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
    // The "token" was the user's own ID, so anyone who learned an ID could attach their Telegram to
    // that account and then sign in as its owner. Linking now happens only through tma-link, which
    // needs the signed-in owner plus Telegram's signed initData.
    void token;
    void telegramId;
    return {
      success: false,
      message: 'Link Telegram from your Beleqet profile inside the Telegram mini app.',
    };
  }

  /**
   * Updates language preference for a Telegram user.
   */
  async updateLanguage(telegramId: string, language: string) {
    const chosen = language === 'am' ? 'am' : 'en';
    const user = await this.prisma.user.findUnique({
      where: { telegramId: String(telegramId) },
      select: { id: true },
    });
    if (user) {
      // The bot speaks it and notifications follow it.
      await this.prisma.notificationPreference.upsert({
        where: { userId: user.id },
        create: { userId: user.id, language: chosen },
        update: { language: chosen },
      });
    }
    return { success: Boolean(user), language: chosen };
  }

  /**
   * Bot registration for job seekers and employers (also used by the SGS Challenge form). Keeps
   * everything the person typed: name, phone, email, password, job title (as the profile
   * headline), the employer's company (as their company profile), language, and the Telegram
   * username Telegram reports.
   */
  async registerFromBot(data: any) {
    const telegramId = data.telegram_id || data.telegramId;
    const email = (data.email || `telegram_${telegramId}@beleqet.internal`).toLowerCase().trim();
    // An employer's contact person; the bot before November 2026 sent only the company name.
    const fullName =
      text(data.contact_name) ||
      text(data.name) ||
      data.first_name ||
      data.firstName ||
      'Telegram User';
    const parts = fullName.trim().split(/\s+/);
    const firstName = parts[0] || 'Telegram';
    const lastName = parts.slice(1).join(' ') || data.last_name || data.lastName || 'User';
    const role =
      data.role === 'employer' || data.role === 'wp_job_board_pro_employer'
        ? 'EMPLOYER'
        : 'JOB_SEEKER';
    const language = data.language === 'am' ? 'am' : 'en';
    const companyName = role === 'EMPLOYER' ? text(data.company_name) : '';

    if (telegramId) {
      const linked = await this.prisma.user.findFirst({
        where: { telegramId: String(telegramId) },
      });
      if (linked) {
        return { success: true, registered: true, role: linked.role, status: 'approved' };
      }
      // An email typed in Telegram proves nothing about who owns it: never hand over or attach to an
      // existing account (this returned the account's ID, which enabled account takeover).
      const emailTaken = await this.prisma.user.findFirst({
        where: { email },
        select: { id: true },
      });
      if (emailTaken) {
        throw new ConflictException(
          'Email already registered. Please enter a different email address for registration.',
        );
      }

      // A password chosen in the bot or the SGS Challenge form lets the person sign in on the
      // website too (where a new account confirms its email with a code first). A shorter one
      // used to be dropped without a word, leaving the person unable to sign in.
      const password = typeof data.password === 'string' ? data.password : '';
      const placeholder = email.endsWith('@beleqet.internal');
      if (!placeholder && password.length < 8) {
        throw new BadRequestException('Choose a password of at least 8 characters.');
      }
      const passwordHash = placeholder ? undefined : await bcrypt.hash(password, 12);

      const created = await this.prisma.user.create({
        data: {
          email,
          telegramId: String(telegramId),
          telegramUsername: telegramUsername(data.tg_username),
          firstName,
          lastName,
          phone: text(data.phone) || null,
          headline: role === 'JOB_SEEKER' ? text(data.job_title) || null : null,
          role: role as any,
          isActive: true,
          ...(passwordHash ? { passwordHash } : {}),
          // Only the placeholder address counts as verified; a real one is confirmed by email.
          emailVerified: placeholder,
          notificationPreference: { create: { language } },
          ...(companyName ? { company: { create: { name: companyName } } } : {}),
        },
      });
      return {
        success: true,
        registered: true,
        role: created.role,
        status: 'approved',
        language,
        email_confirmed: placeholder ? false : created.emailVerified,
      };
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
