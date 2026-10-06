import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { EmailService } from '../email-automation/email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MulterFile } from '../uploads/interfaces/multer-file.interface';
import { UploadsService } from '../uploads/uploads.service';
import { SubmitManualPaymentDto } from './dto/submit-manual-payment.dto';
import { TelegramService } from '../telegram/telegram.service';

export interface ManualPaymentRecord {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  transactionReference: string | null;
  receiptUrl: string | null;
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
    private readonly telegramService: TelegramService,
  ) {}

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

  async submitReceipt(
    dto: SubmitManualPaymentDto,
    file: MulterFile,
    userId: string,
  ): Promise<ManualPaymentRecord> {
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
    const MAX_SIZE = 5 * 1024 * 1024;

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed: JPG, PNG, PDF');
    }
    if ((file.size ?? 0) > MAX_SIZE) {
      throw new BadRequestException('File size exceeds the 5 MB limit');
    }

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

    const uploaded = await this.uploadsService.uploadFile(file, 'manual-receipts', userId);

    const updated = await this.prisma.payment.update({
      where: { id: dto.paymentId },
      data: {
        transactionReference: dto.transactionReference,
        receiptUrl: uploaded.publicUrl,
        status: PaymentStatus.PROCESSING,
      },
    });

    void this.notifyAdmin(updated, dto.transactionReference, uploaded.publicUrl);

    return this.toRecord(updated);
  }

  async findOne(paymentId: string): Promise<ManualPaymentRecord> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }
    return this.toRecord(payment);
  }

  async findAll(page = 1, limit = 20): Promise<ManualPaymentRecord[]> {
    const payments = await this.prisma.payment.findMany({
      where: { provider: PaymentProvider.MANUAL },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return payments.map(this.toRecord);
  }

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
      const adminTelegramId = this.config.get<string>('ADMIN_TELEGRAM_ID');
      if (adminTelegramId) {
        const message =
          `🧾 New manual payment receipt uploaded\n` +
          `Order: ${payment.id}\n` +
          `Amount: ${payment.amount} ${payment.currency}\n` +
          `Reference: ${reference}\n` +
          `Receipt: ${receiptUrl}`;

        await this.telegramService.sendNotification(adminTelegramId, message);
        this.logger.log(`Telegram admin notification sent for payment ${payment.id}`);
      } else {
        this.logger.warn('ADMIN_TELEGRAM_ID not set — skipping Telegram admin notification.');
      }
    } catch (err) {
      this.logger.warn(`Telegram admin notification failed: ${(err as Error).message}`);
    }
  }

  private toRecord(p: {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    status: string;
    transactionReference?: string | null;
    receiptUrl?: string | null;
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
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }
}
