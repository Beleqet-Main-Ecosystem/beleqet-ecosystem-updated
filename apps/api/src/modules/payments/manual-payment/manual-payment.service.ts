import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PushService } from '../../messaging/push/push.service';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import { EmailService } from '../../messaging/email-automation/email.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { MulterFile } from '../../platform/uploads/interfaces/multer-file.interface';
import { UploadsService } from '../../platform/uploads/uploads.service';
import { CreateManualPaymentDto, SubmitManualPaymentDto } from './dto/submit-manual-payment.dto';
import { activatePaidPlan, assertNoPaypalAutoRenew } from '../subscriptions/activate-plan';
import {
  transferApprovedNotice,
  transferRejectedNotice,
} from '../../messaging/notifications/notices';
import { UserNotifier } from '../../messaging/notifications/user-notifier';

export interface ManualPaymentRecord {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  transactionReference: string | null;
  receiptUrl: string | null;
  metadata?: Record<string, unknown> | null;
  /** Admin list only. */
  payer?: { firstName: string; lastName: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ManualPaymentService {
  private readonly logger = new Logger(ManualPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    @Optional() private readonly push?: PushService,
    @Optional() private readonly notifier?: UserNotifier,
  ) {}

  /**
   * The account to pay into (bank, account number, name), from BANK_TRANSFER_DETAILS on the
   * server, so changing it needs no new build of the website or the app. A written "\n" starts a
   * new line. null while it isn't set: the payer is then asked to contact us.
   */
  getBankDetails(): { details: string | null } {
    const details = (this.config.get<string>('BANK_TRANSFER_DETAILS') ?? '')
      .replace(/\\n/g, '\n')
      .trim();
    return { details: details || null };
  }

  /**
   * Creates a new PENDING manual payment record that the customer will
   * complete by uploading a receipt.
   */
  async createManualPayment(
    userId: string,
    input: CreateManualPaymentDto,
  ): Promise<ManualPaymentRecord> {
    // Paying for a plan: the price is the plan's, never what the browser sends.
    let plan: { id: string; name: string; priceAmount: number; currency: string } | null = null;
    if (input.planId) {
      plan = await this.prisma.plan.findFirst({
        where: { id: input.planId, isActive: true, priceAmount: { gt: 0 } },
        select: { id: true, name: true, priceAmount: true, currency: true },
      });
      if (!plan) throw new NotFoundException('That plan is not available');
      await assertNoPaypalAutoRenew(this.prisma, userId);
    } else if (!input.amount || !input.currency) {
      throw new BadRequestException('Give a plan, or an amount and currency');
    }

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        provider: PaymentProvider.MANUAL,
        providerPaymentId: `MANUAL-${randomUUID()}`,
        amount: plan ? plan.priceAmount : input.amount!,
        currency: plan ? plan.currency : input.currency!,
        status: PaymentStatus.PENDING,
        description: plan
          ? `${plan.name} plan by bank transfer`
          : (input.description ?? 'Manual bank transfer payment'),
        metadata: plan ? { planId: plan.id } : undefined,
      },
    });

    return this.toRecord(payment);
  }

  /** The caller's bank-transfer payments, newest first. */
  async findMine(userId: string): Promise<ManualPaymentRecord[]> {
    const payments = await this.prisma.payment.findMany({
      where: { userId, provider: PaymentProvider.MANUAL },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return payments.map((payment) => this.toRecord(payment));
  }

  /**
   * Attaches a receipt file + transaction reference to an existing PENDING
   * manual payment and transitions it to PROCESSING (awaiting admin approval).
   */
  async submitReceipt(
    dto: SubmitManualPaymentDto,
    file: MulterFile,
    userId: string,
  ): Promise<ManualPaymentRecord> {
    // Validate file type & size (JPG/PNG/PDF, max 5 MB)
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
    const MAX_SIZE = 5 * 1024 * 1024;

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed: JPG, PNG, PDF');
    }
    if ((file.size ?? 0) > MAX_SIZE) {
      throw new BadRequestException('File size exceeds the 5 MB limit');
    }

    // Verify payment exists, belongs to this user, and is still PENDING
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${dto.paymentId} not found`);
    }
    if (payment.userId !== userId) {
      throw new BadRequestException('You are not the owner of this payment');
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Payment is already in status ${payment.status}`);
    }

    // Upload receipt via the existing uploads service
    const uploaded = await this.uploadsService.uploadFile(file, 'manual-receipts', userId);

    // Persist reference + receipt URL, advance status to PROCESSING
    const updated = await this.prisma.payment.update({
      where: { id: dto.paymentId },
      data: {
        transactionReference: dto.transactionReference,
        receiptUrl: uploaded.publicUrl,
        status: PaymentStatus.PROCESSING,
      },
    });

    // Fire-and-forget: admin email + Telegram bot webhook (non-blocking)
    void this.notifyAdmin(updated, dto.transactionReference, uploaded.publicUrl);

    // In-app notifications for both user and admins
    void this.createInAppNotificationsOnSubmit(updated, dto.transactionReference);

    return this.toRecord(updated);
  }

  /** One payment; people see only their own (it carries their receipt and bank reference). */
  async findOne(paymentId: string, userId?: string, isAdmin = false): Promise<ManualPaymentRecord> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || (!isAdmin && payment.userId !== userId)) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }
    return this.toRecord(payment);
  }

  /** Lists all manual payments (admin use) */
  async findAll(page = 1, limit = 20, status?: PaymentStatus): Promise<ManualPaymentRecord[]> {
    const payments = await this.prisma.payment.findMany({
      where: { provider: PaymentProvider.MANUAL, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    });
    // Admins need to see who paid; nothing else about the account is sent.
    return payments.map((payment) => ({ ...this.toRecord(payment), payer: payment.user }));
  }

  /**
   * [Admin] Approves a manual payment, transitioning status to SUCCEEDED.
   */
  async approvePayment(paymentId: string, adminId: string): Promise<ManualPaymentRecord> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    if (payment.status === PaymentStatus.SUCCEEDED) {
      return this.toRecord(payment);
    }

    const currentMetadata = (payment.metadata as Record<string, unknown>) ?? {};
    const planId = typeof currentMetadata.planId === 'string' ? currentMetadata.planId : null;
    let approvedNow = false;
    const updated = await this.prisma.$transaction(async (tx) => {
      // A second, simultaneous approval matches nothing here, so a plan is never started twice.
      const { count } = await tx.payment.updateMany({
        where: { id: paymentId, status: { not: PaymentStatus.SUCCEEDED } },
        data: { status: PaymentStatus.SUCCEEDED },
      });
      if (count === 0) return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      approvedNow = true;
      const subscriptionId = planId
        ? await activatePaidPlan(tx, payment.userId, planId, PaymentProvider.MANUAL)
        : undefined;
      return tx.payment.update({
        where: { id: paymentId },
        data: {
          metadata: {
            ...currentMetadata,
            ...(subscriptionId ? { subscriptionId } : {}),
            approvedBy: adminId,
            approvedAt: new Date().toISOString(),
          },
        },
      });
    });

    this.logger.log(`Manual payment ${paymentId} approved by admin ${adminId}`);

    // The bell, their phone and the Jobs bot: payers who signed up in Telegram may have no email.
    if (approvedNow && this.notifier) {
      // Only for the wording; without it the notice still goes, without the plan's name.
      const plan = planId
        ? await this.prisma.plan
            .findUnique({ where: { id: planId }, select: { name: true } })
            .catch(() => null)
        : null;
      await this.notifier.notify(
        payment.userId,
        transferApprovedNotice(payment, plan?.name ?? null),
      );
    }

    // Fire-and-forget user confirmation email
    if (payment.user?.email) {
      const userName =
        `${payment.user.firstName || ''} ${payment.user.lastName || ''}`.trim() || 'User';
      void this.emailService
        .dispatch({
          recipient: payment.user.email,
          type: 'PAYMENT_RECEIPT',
          userId: payment.userId,
          variables: {
            name: userName,
            transactionId: payment.id,
            amount: (payment.amount / 100).toLocaleString('en-US'),
            currency: payment.currency,
            paidAt: new Date().toLocaleDateString('en-US'),
            reference: payment.transactionReference ?? 'N/A',
            receiptUrl: payment.receiptUrl ?? '',
          },
        })
        .catch((err) =>
          this.logger.warn(`Failed to dispatch user receipt approval email: ${err.message}`),
        );
    }

    return this.toRecord(updated);
  }

  /**
   * [Admin] Rejects a manual payment with an optional reason, transitioning status to FAILED.
   */
  async rejectPayment(
    paymentId: string,
    adminId: string,
    reason?: string,
  ): Promise<ManualPaymentRecord> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    const currentMetadata = (payment.metadata as Record<string, unknown>) ?? {};
    // An approved payment has started its plan, so it can't be rejected, even by an admin who
    // clicks Reject a moment after another admin approved it.
    const { count } = await this.prisma.payment.updateMany({
      where: { id: paymentId, status: { not: PaymentStatus.SUCCEEDED } },
      data: {
        status: PaymentStatus.FAILED,
        metadata: {
          ...currentMetadata,
          rejectedBy: adminId,
          rejectedAt: new Date().toISOString(),
          rejectionReason: reason ?? 'Receipt verification rejected by administrator.',
        },
      },
    });
    if (count === 0) {
      throw new ConflictException('This payment is already approved and its plan has started.');
    }
    const updated = await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

    this.logger.log(`Manual payment ${paymentId} rejected by admin ${adminId}. Reason: ${reason}`);

    await this.notifier?.notify(payment.userId, transferRejectedNotice(payment, reason));

    return this.toRecord(updated);
  }

  /**
   * Approve or Reject pressed in the Jobs bot. Like the admin site, it acts only on a receipt that
   * is still waiting: every admin gets the alert, and the first one to decide wins.
   */
  async decideFromTelegram(
    paymentId: string,
    approve: boolean,
    adminId: string,
  ): Promise<ManualPaymentRecord> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.provider !== PaymentProvider.MANUAL) {
      throw new NotFoundException('This payment no longer exists.');
    }
    if (payment.status !== PaymentStatus.PROCESSING) {
      const already: Partial<Record<PaymentStatus, string>> = {
        SUCCEEDED: 'This payment is already approved.',
        FAILED: 'This payment is already rejected.',
        PENDING: 'No receipt has been sent for this payment yet.',
      };
      throw new ConflictException(already[payment.status] ?? `This payment is ${payment.status}.`);
    }
    return approve
      ? this.approvePayment(paymentId, adminId)
      : this.rejectPayment(paymentId, adminId);
  }

  /**
   * Resolves a secure viewable URL for an uploaded receipt.
   * If stored in cloud storage (S3/R2), generates a temporary presigned read URL.
   */
  async getReceiptViewUrl(
    paymentId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<{ url: string }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    if (!isAdmin && payment.userId !== userId) {
      throw new BadRequestException('You do not have permission to view this receipt');
    }

    if (!payment.receiptUrl) {
      throw new NotFoundException('No receipt uploaded for this payment');
    }

    const key = payment.receiptUrl.match(/(manual-receipts\/[A-Za-z0-9_-]+\.[a-z0-9]+)/i)?.[1];

    // Local storage: links saved at upload time can carry an old address (http://localhost:4000),
    // so build the link from the file's key with the current API address, and say plainly when
    // the file is not on this server instead of handing out a link that fails.
    if (this.uploadsService.isLocalFallbackActive()) {
      if (!key) return { url: payment.receiptUrl };
      if (!fs.existsSync(this.uploadsService.resolveLocalFilePath(key))) {
        throw new NotFoundException(
          'The receipt file is not stored on this server. Ask the payer to send it again.',
        );
      }
      return { url: this.uploadsService.localFileUrl(key) };
    }

    // If S3/R2, generate a presigned read URL from the key
    try {
      if (key) {
        const presignedUrl = await this.uploadsService.getPresignedReadUrl(key);
        return { url: presignedUrl };
      }
    } catch (err) {
      this.logger.warn(
        `Could not generate presigned read URL for ${payment.receiptUrl}: ${(err as Error).message}`,
      );
    }

    return { url: payment.receiptUrl };
  }

  // ─── private helpers ──────────────────────────────────────────────────────

  private async notifyAdmin(
    payment: {
      id: string;
      amount: number;
      currency: string;
      userId: string;
      metadata?: unknown;
    },
    reference: string,
    receiptUrl: string,
  ): Promise<void> {
    try {
      // 1. Admin email (PAYMENT_ALERT_EMAIL; not ADMIN_EMAIL, which creates the first admin account)
      const adminEmail =
        this.config.get<string>('PAYMENT_ALERT_EMAIL')?.trim() || 'admin@beleqetjobs.com';
      await this.emailService.dispatch({
        recipient: adminEmail,
        type: 'PAYMENT_RECEIPT',
        userId: payment.userId,
        variables: {
          paymentId: payment.id,
          amount: (payment.amount / 100).toLocaleString('en-US'),
          currency: payment.currency,
          reference,
          receiptUrl,
        },
      });
    } catch (err) {
      this.logger.warn(`Admin email dispatch failed: ${(err as Error).message}`);
    }

    try {
      // 2. The Jobs bot, which sends it to the bot's admins with Approve / Reject buttons
      const webhookUrl = this.config.get<string>('BELEQET_BOT_WEBHOOK_URL');
      const webhookSecret = this.config.get<string>('WEBHOOK_SECRET_TOKEN', '');

      if (webhookUrl) {
        const metadata = (payment.metadata as Record<string, unknown> | null) ?? {};
        const planId = typeof metadata.planId === 'string' ? metadata.planId : null;
        const [payer, plan] = await Promise.all([
          this.prisma.user.findUnique({
            where: { id: payment.userId },
            select: { firstName: true, lastName: true, email: true },
          }),
          planId
            ? this.prisma.plan.findUnique({ where: { id: planId }, select: { name: true } })
            : null,
        ]);
        const payerName = `${payer?.firstName ?? ''} ${payer?.lastName ?? ''}`.trim();
        await this.postJson(webhookUrl, webhookSecret, {
          action: 'manual_payment_uploaded',
          order_id: payment.id,
          amount: (payment.amount / 100).toLocaleString('en-US'),
          currency: payment.currency,
          reference,
          receipt_url: receiptUrl,
          payer: [payerName, payer?.email].filter(Boolean).join(' · '),
          plan: plan?.name ?? '',
        });
      }
    } catch (err) {
      this.logger.warn(`Telegram webhook dispatch failed: ${(err as Error).message}`);
    }
  }

  /**
   * Lightweight POST, so axios isn't needed for one webhook call. http too: the Jobs bot runs on
   * the same server and is reached directly, not through a public address.
   */
  private postJson(url: string, secret: string, body: object): Promise<void> {
    return new Promise((resolve) => {
      const payload = JSON.stringify(body);
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'http:' ? http : https;

      const req = client.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (client === http ? 80 : 443),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            ...(secret ? { 'X-Telegram-Bot-Api-Secret-Token': secret } : {}),
          },
          timeout: 15_000,
        },
        (res) => {
          if ((res.statusCode ?? 0) >= 300) {
            this.logger.warn(`Webhook ${parsedUrl.host} answered HTTP ${res.statusCode}`);
          }
          res.resume();
          resolve();
        },
      );

      req.on('error', (err) => {
        this.logger.warn(`Webhook HTTP error: ${err.message}`);
        resolve(); // non-blocking — never reject
      });
      req.on('timeout', () => {
        req.destroy();
        resolve();
      });

      req.write(payload);
      req.end();
    });
  }

  private toRecord(p: {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    status: string;
    transactionReference?: string | null;
    receiptUrl?: string | null;
    metadata?: unknown;
    createdAt: Date;
    updatedAt: Date;
  }): ManualPaymentRecord {
    return {
      id: p.id,
      userId: p.userId,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      transactionReference: p.transactionReference ?? null,
      receiptUrl: p.receiptUrl ?? null,
      metadata: (p.metadata as Record<string, unknown>) ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  private async createInAppNotificationsOnSubmit(
    payment: { id: string; userId: string; amount: number; currency: string },
    reference: string,
  ): Promise<void> {
    try {
      // 1. In-app notification for the user submitting payment
      await this.prisma.notification.create({
        data: {
          userId: payment.userId,
          type: 'PAYMENT_RECEIVED',
          title: 'Payment Receipt Submitted',
          body: `Your payment receipt of ${payment.currency} ${(payment.amount / 100).toLocaleString('en-US')} (Ref: ${reference}) was received and is under review.`,
          channel: 'IN_APP',
          metadata: { paymentId: payment.id, reference },
        },
      });
      await this.push?.sendToUser(payment.userId, {
        title: 'Payment Receipt Submitted',
        body: `Your receipt (Ref: ${reference}) was received and is under review.`,
        metadata: { paymentId: payment.id },
      });

      // 2. In-app notification for active admins
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true },
      });
      for (const admin of admins) {
        await this.prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'PAYMENT_RECEIVED',
            title: 'New Manual Payment Received',
            body: `A manual payment of ${payment.currency} ${(payment.amount / 100).toLocaleString('en-US')} (Ref: ${reference}) was submitted and requires review.`,
            channel: 'IN_APP',
            metadata: { paymentId: payment.id, reference },
          },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to create in-app notifications on payment submit: ${(err as Error).message}`,
      );
    }
  }
}
