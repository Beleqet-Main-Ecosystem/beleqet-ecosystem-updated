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
import { PaymentProvider, PaymentStatus, Prisma } from '@prisma/client';
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
  CbeLookup,
  CbeReceipt,
  CbeReceiptService,
  normalizeCbeReference,
  sameCbeAccount,
} from './cbe-receipt.service';

/** A transfer checked with CBE. receipt: it matches, approve it. note: why not, for the admins. */
type CbeCheck = { receipt?: CbeReceipt; note?: string };

/** Who approved a payment that matched its CBE receipt (approvedBy in the payment's metadata). */
export const CBE_RECEIPT_APPROVER = 'cbe-receipt';
/** A receipt older than this isn't accepted automatically: an admin looks at it. */
const CBE_RECEIPT_MAX_AGE_MS = 7 * 24 * 3600 * 1000;
/** Allowance for CBE's clock against ours. */
const CBE_CLOCK_SLACK_MS = 3600 * 1000;
const CBE_NOT_FOUND: Record<Extract<CbeLookup, { found: false }>['reason'], string> = {
  'not-found': 'CBE has no transfer with this reference into our account.',
  unreadable: "CBE's receipt for this reference couldn't be read.",
  unavailable: "CBE's receipt site didn't answer, so it wasn't checked.",
};

/** What the admins are told when a transfer has already paid for something. */
function alreadyUsed(reference: string, usedBy: string): string {
  const [system, id] = usedBy.split(':');
  return system === 'promotion'
    ? `${reference} already paid for Promotion bot deposit #${id}.`
    : `${reference} already paid for another Jobs payment (${id}).`;
}

/** "25 Nov 2026, 13:09", in Ethiopian time. */
function ethiopianTime(date: Date): string {
  return date.toLocaleString('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'P2002';
}

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
    private readonly cbe: CbeReceiptService,
    @Optional() private readonly push?: PushService,
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

    // A transfer from a CBE account is checked on CBE's own receipt page; if everything matches,
    // the plan starts now, without waiting for an admin.
    let check: CbeCheck | null = await this.checkWithCbe(updated).catch((err: Error) => {
      this.logger.warn(`CBE check of payment ${updated.id} failed: ${err.message}`);
      return { note: "The automatic check with CBE failed, so it wasn't checked." };
    });
    if (check?.receipt) {
      try {
        const approved = await this.approvePayment(updated.id, CBE_RECEIPT_APPROVER, check.receipt);
        void this.notifyAutoApproved(updated, check.receipt);
        return approved;
      } catch (err) {
        // The same transfer paid for something else a moment ago.
        check = { note: (err as Error).message };
      }
    }

    // Otherwise an admin decides, told what the check found.
    const waiting = check?.note
      ? await this.prisma.payment.update({
          where: { id: updated.id },
          data: {
            metadata: {
              ...((updated.metadata as Record<string, unknown> | null) ?? {}),
              cbeCheck: check.note,
            },
          },
        })
      : updated;

    // Fire-and-forget: admin email + Telegram bot webhook (non-blocking)
    void this.notifyAdmin(waiting, dto.transactionReference, uploaded.publicUrl, check?.note);

    // In-app notifications for both user and admins
    void this.createInAppNotificationsOnSubmit(waiting, dto.transactionReference);

    return this.toRecord(waiting);
  }

  /**
   * Records a Promotion bot deposit's transfer, so it can't also pay for a Jobs plan (both take
   * payments into the same account). Refused when the transfer has already paid for something.
   */
  async claimBankReference(reference: string, usedBy: string): Promise<{ claimed: true }> {
    const ft = normalizeCbeReference(reference);
    if (!ft) throw new BadRequestException('Not a CBE transfer reference (FT…)');
    const used = await this.prisma.bankReference.findUnique({ where: { reference: ft } });
    if (used) {
      if (used.usedBy === usedBy) return { claimed: true };
      throw new ConflictException(alreadyUsed(ft, used.usedBy));
    }
    try {
      await this.prisma.bankReference.create({ data: { reference: ft, usedBy } });
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException(`${ft} was used a moment ago.`);
      throw err;
    }
    return { claimed: true };
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
   * [Admin] Approves a manual payment, transitioning status to SUCCEEDED. A CBE transfer reference is
   * recorded as used, and one that has already paid for something is refused. `cbeReceipt`: what
   * CBE's receipt said, when the payment was approved by matching it.
   */
  async approvePayment(
    paymentId: string,
    adminId: string,
    cbeReceipt?: CbeReceipt,
  ): Promise<ManualPaymentRecord> {
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
    const updated = await this.prisma
      .$transaction(async (tx) => {
        // A second, simultaneous approval matches nothing here, so a plan is never started twice.
        const { count } = await tx.payment.updateMany({
          where: { id: paymentId, status: { not: PaymentStatus.SUCCEEDED } },
          data: { status: PaymentStatus.SUCCEEDED },
        });
        if (count === 0) return tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
        await this.claimTransfer(tx, payment.transactionReference, paymentId);
        const subscriptionId = planId
          ? await activatePaidPlan(tx, payment.userId, planId, PaymentProvider.MANUAL)
          : undefined;
        return tx.payment.update({
          where: { id: paymentId },
          data: {
            metadata: {
              ...currentMetadata,
              ...(subscriptionId ? { subscriptionId } : {}),
              ...(cbeReceipt
                ? {
                    cbeReceipt: {
                      payer: cbeReceipt.payer,
                      payerAccount: cbeReceipt.payerAccount,
                      amount: cbeReceipt.amount,
                      paidAt: cbeReceipt.paidAt.toISOString(),
                    },
                  }
                : {}),
              approvedBy: adminId,
              approvedAt: new Date().toISOString(),
            },
          },
        });
      })
      .catch((err: unknown) => {
        // Another payment recorded the same transfer between our check and our write.
        if (isUniqueViolation(err)) {
          throw new ConflictException('This bank transfer paid for something else a moment ago.');
        }
        throw err;
      });

    this.logger.log(`Manual payment ${paymentId} approved by admin ${adminId}`);

    // In-app notification for the paying user
    void this.prisma.notification
      .create({
        data: {
          userId: payment.userId,
          type: 'PAYMENT_RECEIVED',
          title: 'Payment Approved',
          body: `Your payment of ${payment.currency} ${(payment.amount / 100).toLocaleString('en-US')} has been approved.`,
          channel: 'IN_APP',
          metadata: { paymentId: payment.id, approvedBy: adminId },
        },
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to create in-app notification for approved payment: ${err.message}`,
        ),
      );

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

    // In-app notification for the user
    void this.prisma.notification
      .create({
        data: {
          userId: payment.userId,
          type: 'PAYMENT_RECEIVED',
          title: 'Payment Rejected',
          body: `Your payment of ${payment.currency} ${(payment.amount / 100).toLocaleString('en-US')} was rejected.${reason ? ` Reason: ${reason}` : ''}`,
          channel: 'IN_APP',
          metadata: { paymentId: payment.id, rejectedBy: adminId, reason },
        },
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to create in-app notification for rejected payment: ${err.message}`,
        ),
      );

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

  /**
   * Looks the payment's transfer up on CBE's receipt page (for the account in CBE_RECEIPT_ACCOUNT).
   * `receipt`: it matches, approve it. `note`: why it can't be approved automatically, for the
   * admins. null: automatic checks are off.
   */
  private async checkWithCbe(payment: {
    amount: number;
    currency: string;
    transactionReference: string | null;
  }): Promise<CbeCheck | null> {
    const account = (this.config.get<string>('CBE_RECEIPT_ACCOUNT') ?? '').replace(/\D/g, '');
    if (account.length < 8) return null;
    const reference = normalizeCbeReference(payment.transactionReference ?? '');
    if (!reference)
      return { note: 'Not checked: the reference is not a CBE transfer number (FT…).' };
    if (payment.currency !== 'ETB') return { note: 'Not checked: CBE transfers are in ETB.' };

    const used = await this.prisma.bankReference.findUnique({ where: { reference } });
    if (used) return { note: alreadyUsed(reference, used.usedBy) };

    const lookup = await this.cbe.lookup(reference, account);
    if (!lookup.found) return { note: CBE_NOT_FOUND[lookup.reason] };
    const { receipt } = lookup;
    const etb = (santim: number) => (santim / 100).toLocaleString('en-US');
    if (receipt.reference !== reference || !sameCbeAccount(receipt.receiverAccount, account)) {
      return {
        note: `CBE's receipt shows the money went to account ${receipt.receiverAccount}, not ours.`,
      };
    }
    if (receipt.amount !== payment.amount) {
      return {
        note: `CBE's receipt shows ${etb(receipt.amount)} ETB; this payment is ${etb(payment.amount)} ETB.`,
      };
    }
    const age = Date.now() - receipt.paidAt.getTime();
    if (age > CBE_RECEIPT_MAX_AGE_MS || age < -CBE_CLOCK_SLACK_MS) {
      return {
        note: `CBE's receipt is dated ${ethiopianTime(receipt.paidAt)}, not within the last 7 days.`,
      };
    }
    return { receipt };
  }

  /** Records the payment's CBE transfer as used, inside its approval; refuses one already used. */
  private async claimTransfer(
    tx: Prisma.TransactionClient,
    transactionReference: string | null,
    paymentId: string,
  ): Promise<void> {
    const reference = normalizeCbeReference(transactionReference ?? '');
    if (!reference) return;
    const usedBy = `jobs:${paymentId}`;
    const used = await tx.bankReference.findUnique({ where: { reference } });
    if (used && used.usedBy !== usedBy) {
      throw new ConflictException(`${alreadyUsed(reference, used.usedBy)} Reject this payment.`);
    }
    if (!used) await tx.bankReference.create({ data: { reference, usedBy } });
  }

  /** Who paid and for which plan, for the admins' Telegram messages. */
  private async alertDetails(payment: {
    id: string;
    amount: number;
    currency: string;
    userId: string;
    metadata?: unknown;
  }): Promise<Record<string, string>> {
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
    return {
      order_id: payment.id,
      amount: (payment.amount / 100).toLocaleString('en-US'),
      currency: payment.currency,
      payer: [payerName, payer?.email].filter(Boolean).join(' · '),
      plan: plan?.name ?? '',
    };
  }

  /** Tells the admins that a transfer matched its CBE receipt and its plan has started. */
  private async notifyAutoApproved(
    payment: { id: string; amount: number; currency: string; userId: string; metadata?: unknown },
    receipt: CbeReceipt,
  ): Promise<void> {
    try {
      const webhookUrl = this.config.get<string>('BELEQET_BOT_WEBHOOK_URL');
      if (webhookUrl) {
        await this.postJson(webhookUrl, this.config.get<string>('WEBHOOK_SECRET_TOKEN', ''), {
          action: 'manual_payment_auto_approved',
          ...(await this.alertDetails(payment)),
          reference: receipt.reference,
          bank_payer: receipt.payer,
          paid_at: ethiopianTime(receipt.paidAt),
        });
      }
      const admins = await this.prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true },
      });
      for (const admin of admins) {
        await this.prisma.notification.create({
          data: {
            userId: admin.id,
            type: 'PAYMENT_RECEIVED',
            title: 'Bank transfer approved automatically',
            body: `A transfer of ${payment.currency} ${(payment.amount / 100).toLocaleString('en-US')} (Ref: ${receipt.reference}) matched its CBE receipt, so its plan has started.`,
            channel: 'IN_APP',
            metadata: { paymentId: payment.id, reference: receipt.reference },
          },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Could not tell the admins about payment ${payment.id}: ${(err as Error).message}`,
      );
    }
  }

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
    cbeCheck?: string,
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
        await this.postJson(webhookUrl, webhookSecret, {
          action: 'manual_payment_uploaded',
          ...(await this.alertDetails(payment)),
          reference,
          receipt_url: receiptUrl,
          ...(cbeCheck ? { cbe_check: cbeCheck } : {}),
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
