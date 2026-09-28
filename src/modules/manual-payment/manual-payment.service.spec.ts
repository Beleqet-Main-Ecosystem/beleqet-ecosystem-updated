import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { EmailService } from '../email-automation/email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { MulterFile } from '../uploads/interfaces/multer-file.interface';
import { ManualPaymentService } from './manual-payment.service';

describe('ManualPaymentService', () => {
  let service: ManualPaymentService;

  const mockPrismaService = {
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    },
  };

  const mockUploadsService = {
    uploadFile: jest.fn(),
    isLocalFallbackActive: jest.fn(),
    getPresignedReadUrl: jest.fn(),
  };

  const mockEmailService = {
    dispatch: jest.fn().mockResolvedValue(null),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        ADMIN_EMAIL: 'admin@beleqetjobs.com',
        API_BASE_URL: 'http://localhost:4000/api/v1',
      };
      return values[key] ?? defaultValue;
    }),
  };

  const createDummyPayment = (overrides = {}) => ({
    id: 'pay-uuid-1',
    userId: 'user-uuid-1',
    provider: PaymentProvider.MANUAL,
    providerPaymentId: 'MANUAL-1234',
    amount: 150000,
    currency: 'ETB',
    status: PaymentStatus.PENDING,
    description: 'Manual bank transfer',
    transactionReference: null,
    receiptUrl: null,
    metadata: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  });

  const createDummyFile = (mimetype = 'image/jpeg', size = 1024): MulterFile => ({
    fieldname: 'receipt',
    originalname: 'receipt.jpg',
    encoding: '7bit',
    mimetype,
    size,
    buffer: Buffer.from('dummy image content'),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManualPaymentService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: UploadsService, useValue: mockUploadsService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ManualPaymentService>(ManualPaymentService);
  });

  describe('createManualPayment', () => {
    it('creates a PENDING manual payment record in prisma', async () => {
      const dummy = createDummyPayment();
      mockPrismaService.payment.create.mockResolvedValue(dummy);

      const record = await service.createManualPayment('user-uuid-1', 150000, 'ETB');

      expect(record.id).toBe(dummy.id);
      expect(record.status).toBe(PaymentStatus.PENDING);
      expect(mockPrismaService.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-uuid-1',
            provider: PaymentProvider.MANUAL,
            amount: 150000,
            currency: 'ETB',
            status: PaymentStatus.PENDING,
          }),
        }),
      );
    });
  });

  describe('submitReceipt', () => {
    it('rejects disallowed file MIME types', async () => {
      const file = createDummyFile('text/plain');

      await expect(
        service.submitReceipt(
          { paymentId: 'pay-uuid-1', transactionReference: 'TXN123' },
          file,
          'user-uuid-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects files larger than 5 MB', async () => {
      const file = createDummyFile('image/jpeg', 6 * 1024 * 1024);

      await expect(
        service.submitReceipt(
          { paymentId: 'pay-uuid-1', transactionReference: 'TXN123' },
          file,
          'user-uuid-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when payment does not exist', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);
      const file = createDummyFile('image/jpeg');

      await expect(
        service.submitReceipt(
          { paymentId: 'missing-pay', transactionReference: 'TXN123' },
          file,
          'user-uuid-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when caller does not own the payment', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(createDummyPayment({ userId: 'other-user' }));
      const file = createDummyFile('image/jpeg');

      await expect(
        service.submitReceipt(
          { paymentId: 'pay-uuid-1', transactionReference: 'TXN123' },
          file,
          'user-uuid-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('uploads receipt and transitions status to PROCESSING', async () => {
      const dummy = createDummyPayment();
      mockPrismaService.payment.findUnique.mockResolvedValue(dummy);
      mockUploadsService.uploadFile.mockResolvedValue({
        publicUrl: 'http://localhost:4000/api/v1/uploads/local-file/manual-receipts/abc.webp',
        key: 'manual-receipts/abc.webp',
      });
      mockPrismaService.payment.update.mockResolvedValue({
        ...dummy,
        transactionReference: 'TXN-999',
        receiptUrl: 'http://localhost:4000/api/v1/uploads/local-file/manual-receipts/abc.webp',
        status: PaymentStatus.PROCESSING,
      });

      const file = createDummyFile('image/png');
      const result = await service.submitReceipt(
        { paymentId: 'pay-uuid-1', transactionReference: 'TXN-999' },
        file,
        'user-uuid-1',
      );

      expect(result.status).toBe(PaymentStatus.PROCESSING);
      expect(result.transactionReference).toBe('TXN-999');
      expect(mockUploadsService.uploadFile).toHaveBeenCalledWith(file, 'manual-receipts', 'user-uuid-1');
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-uuid-1' },
          data: expect.objectContaining({
            status: PaymentStatus.PROCESSING,
            transactionReference: 'TXN-999',
          }),
        }),
      );
    });
  });

  describe('approvePayment', () => {
    it('throws NotFoundException if payment does not exist', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      await expect(service.approvePayment('missing-pay', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('approves a pending/processing payment and dispatches confirmation email', async () => {
      const dummy = createDummyPayment({
        status: PaymentStatus.PROCESSING,
        transactionReference: 'TXN-REF-1',
        receiptUrl: 'http://localhost:4000/api/v1/uploads/local-file/manual-receipts/abc.webp',
        user: { email: 'client@example.com' },
      });
      mockPrismaService.payment.findUnique.mockResolvedValue(dummy);
      mockPrismaService.payment.update.mockResolvedValue({
        ...dummy,
        status: PaymentStatus.SUCCEEDED,
        metadata: { approvedBy: 'admin-1' },
      });

      const result = await service.approvePayment('pay-uuid-1', 'admin-1');

      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
      expect(mockPrismaService.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-uuid-1' },
          data: expect.objectContaining({
            status: PaymentStatus.SUCCEEDED,
          }),
        }),
      );
      expect(mockEmailService.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: 'client@example.com',
          type: 'PAYMENT_RECEIPT',
        }),
      );
    });
  });

  describe('rejectPayment', () => {
    it('throws NotFoundException if payment does not exist', async () => {
      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      await expect(service.rejectPayment('missing-pay', 'admin-1', 'Invalid ref')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a payment and records rejection reason in metadata', async () => {
      const dummy = createDummyPayment({ status: PaymentStatus.PROCESSING });
      mockPrismaService.payment.findUnique.mockResolvedValue(dummy);
      mockPrismaService.payment.update.mockResolvedValue({
        ...dummy,
        status: PaymentStatus.FAILED,
        metadata: {
          rejectedBy: 'admin-1',
          rejectionReason: 'Invalid reference',
        },
      });

      const result = await service.rejectPayment('pay-uuid-1', 'admin-1', 'Invalid reference');

      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.metadata).toEqual(
        expect.objectContaining({
          rejectedBy: 'admin-1',
          rejectionReason: 'Invalid reference',
        }),
      );
    });
  });

  describe('getReceiptViewUrl', () => {
    it('returns local URL directly when local fallback is active', async () => {
      const dummy = createDummyPayment({
        receiptUrl: 'http://localhost:4000/api/v1/uploads/local-file/manual-receipts/abc.webp',
      });
      mockPrismaService.payment.findUnique.mockResolvedValue(dummy);
      mockUploadsService.isLocalFallbackActive.mockReturnValue(true);

      const result = await service.getReceiptViewUrl('pay-uuid-1', 'admin-1', true);
      expect(result.url).toBe(dummy.receiptUrl);
    });

    it('generates presigned read URL when cloud storage is active', async () => {
      const dummy = createDummyPayment({
        receiptUrl: 'https://cdn.beleqet.com/manual-receipts/11111111-2222-3333-4444-555555555555.webp',
      });
      mockPrismaService.payment.findUnique.mockResolvedValue(dummy);
      mockUploadsService.isLocalFallbackActive.mockReturnValue(false);
      mockUploadsService.getPresignedReadUrl.mockResolvedValue('https://s3.signed-url.com/receipt');

      const result = await service.getReceiptViewUrl('pay-uuid-1', 'admin-1', true);
      expect(result.url).toBe('https://s3.signed-url.com/receipt');
      expect(mockUploadsService.getPresignedReadUrl).toHaveBeenCalledWith(
        'manual-receipts/11111111-2222-3333-4444-555555555555.webp',
      );
    });
  });
});
