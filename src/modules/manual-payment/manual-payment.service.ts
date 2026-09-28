import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as https from 'https';
import { EmailService } from '../email-automation/email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MulterFile } from '../uploads/interfaces/multer-file.interface';
import { UploadsService } from '../uploads/uploads.service';
import { SubmitManualPaymentDto } from './dto/submit-manual-payment.dto';

export interface ManualPaymentRecord {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  transactionReference: string | null;
  receiptUrl: string | null;
  metadata?: Record<string, unknown> | null;
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
  ) {}

  /**
   * Creates a new PENDING manual payment record that the customer will
   * complete by uploading a receipt.
   */
  async createManualPayment(
    userId: string,
    amount: number,
    currency: string,
    description?: string,
  ): Promise<ManualPaymentRecord> {
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        provider: PaymentProvider.MANUAL,
        providerPaymentId: `MANUAL-${randomUUID()}`,
        amount,
        currency,
        status: PaymentStatus.PENDING,
        description: description ?? 'Manual bank transfer payment',
      },
    });

    return this.toRecord(payment);
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

  /** Returns a single payment record */
  async findOne(paymentId: string): Promise<ManualPaymentRecord> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }
    return this.toRecord(payment);
  }

  /** Lists all manual payments (admin use) */
  async findAll(page = 1, limit = 20): Promise<ManualPaymentRecord[]> {
    const payments = await this.prisma.payment.findMany({
      where: { provider: PaymentProvider.MANUAL },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return payments.map(this.toRecord);
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
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.SUCCEEDED,
        metadata: {
          ...currentMetadata,
          approvedBy: adminId,
          approvedAt: new Date().toISOString(),
        },
      },
    });

    this.logger.log(`Manual payment ${paymentId} approved by admin ${adminId}`);

    // In-app notification for the paying user
    void this.prisma.notification
      .create({
        data: {
          userId: payment.userId,
          type: 'PAYMENT_RECEIVED',
          title: 'Payment Approved',
          body: `Your manual payment of ${payment.amount} ${payment.currency} has been approved.`,
          channel: 'IN_APP',
          metadata: { paymentId: payment.id, approvedBy: adminId },
        },
      })
      .catch((err) =>
        this.logger.warn(`Failed to create in-app notification for approved payment: ${err.message}`),
      );

    // Fire-and-forget user confirmation email
    if (payment.user?.email) {
      const userName = `${payment.user.firstName || ''} ${payment.user.lastName || ''}`.trim() || 'User';
      void this.emailService
        .dispatch({
          recipient: payment.user.email,
          type: 'PAYMENT_RECEIPT',
          userId: payment.userId,
          variables: {
            name: userName,
            transactionId: payment.id,
            amount: payment.amount,
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
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
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

    this.logger.log(`Manual payment ${paymentId} rejected by admin ${adminId}. Reason: ${reason}`);

    // In-app notification for the user
    void this.prisma.notification
      .create({
        data: {
          userId: payment.userId,
          type: 'PAYMENT_RECEIVED',
          title: 'Payment Rejected',
          body: `Your manual payment of ${payment.amount} ${payment.currency} was rejected.${reason ? ` Reason: ${reason}` : ''}`,
          channel: 'IN_APP',
          metadata: { paymentId: payment.id, rejectedBy: adminId, reason },
        },
      })
      .catch((err) =>
        this.logger.warn(`Failed to create in-app notification for rejected payment: ${err.message}`),
      );

    return this.toRecord(updated);
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

    // If local fallback, return the URL directly
    if (this.uploadsService.isLocalFallbackActive()) {
      return { url: payment.receiptUrl };
    }

    // If S3/R2, extract key and generate presigned read URL
    try {
      const match = payment.receiptUrl.match(/(manual-receipts\/[A-Za-z0-9_-]+\.[a-z0-9]+)/i);
      if (match && match[1]) {
        const presignedUrl = await this.uploadsService.getPresignedReadUrl(match[1]);
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
    },
    reference: string,
    receiptUrl: string,
  ): Promise<void> {
    try {
      // 1. Admin email
      const adminEmail = this.config.get<string>('ADMIN_EMAIL', 'admin@beleqetjobs.com');
      await this.emailService.dispatch({
        recipient: adminEmail,
        type: 'PAYMENT_RECEIPT',
        userId: payment.userId,
        variables: {
          paymentId: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          reference,
          receiptUrl,
        },
      });
    } catch (err) {
      this.logger.warn(`Admin email dispatch failed: ${(err as Error).message}`);
    }

    try {
      // 2. Telegram bot webhook (matches PHP logic)
      const webhookUrl = this.config.get<string>('BELEQET_BOT_WEBHOOK_URL');
      const webhookSecret = this.config.get<string>('WEBHOOK_SECRET_TOKEN', '');

      if (webhookUrl) {
        await this.postJson(webhookUrl, webhookSecret, {
          action: 'manual_payment_uploaded',
          order_id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          reference,
          receipt_url: receiptUrl,
        });
      }
    } catch (err) {
      this.logger.warn(`Telegram webhook dispatch failed: ${(err as Error).message}`);
    }
  }

  /** Lightweight HTTPS POST — avoids pulling in axios just for a webhook call */
  private postJson(url: string, secret: string, body: object): Promise<void> {
    return new Promise((resolve) => {
      const payload = JSON.stringify(body);
      const parsedUrl = new URL(url);

      const req = https.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            ...(secret ? { 'X-Telegram-Bot-Api-Secret-Token': secret } : {}),
          },
          timeout: 15_000,
        },
        () => resolve(),
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
          body: `Your payment receipt of ${payment.amount} ${payment.currency} (Ref: ${reference}) was received and is under review.`,
          channel: 'IN_APP',
          metadata: { paymentId: payment.id, reference },
        },
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
            body: `A manual payment of ${payment.amount} ${payment.currency} (Ref: ${reference}) was submitted and requires review.`,
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
