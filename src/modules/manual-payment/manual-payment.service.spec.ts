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

  const mockPrismaService: Record<string, any> = {
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUniqueOrThrow: jest.fn(),
    },
    plan: { findFirst: jest.fn(), findUniqueOrThrow: jest.fn() },
    subscription: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>): Promise<unknown> => fn(mockPrismaService)),
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

      const record = await service.createManualPayment('user-uuid-1', { amount: 150000, currency: 'ETB' });

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
      mockPrismaService.payment.findUnique.mockResolvedValue(
        createDummyPayment({ userId: 'other-user' }),
      );
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
      expect(mockUploadsService.uploadFile).toHaveBeenCalledWith(
        file,
        'manual-receipts',
        'user-uuid-1',
      );
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

      await expect(service.approvePayment('missing-pay', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
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
      expect(mockPrismaService.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'pay-uuid-1', status: { not: PaymentStatus.SUCCEEDED } },
        data: { status: PaymentStatus.SUCCEEDED },
      });
      expect(mockPrismaService.subscription.create).not.toHaveBeenCalled();
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
        receiptUrl:
          'https://cdn.beleqet.com/manual-receipts/11111111-2222-3333-4444-555555555555.webp',
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

describe('ManualPaymentService plans and privacy', () => {
  const prisma: Record<string, any> = {
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
    },
    plan: { findFirst: jest.fn(), findUniqueOrThrow: jest.fn() },
    subscription: { findFirst: jest.fn(), update: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
    notification: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>): Promise<unknown> => fn(prisma)),
  };
  const now = new Date();
  const record = (extra: Record<string, unknown> = {}) => ({
    id: 'p1', userId: 'u1', amount: 500, currency: 'ETB', status: 'PROCESSING', metadata: { planId: 'pro' },
    createdAt: now, updatedAt: now, user: { email: '' }, ...extra,
  });
  let service: ManualPaymentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ManualPaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: UploadsService, useValue: {} },
        { provide: EmailService, useValue: { dispatch: jest.fn().mockResolvedValue(undefined) } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    service = module.get(ManualPaymentService);
    prisma.payment.updateMany.mockResolvedValue({ count: 1 });
    prisma.payment.update.mockResolvedValue(record({ status: 'SUCCEEDED' }));
    prisma.plan.findUniqueOrThrow.mockResolvedValue({ id: 'pro', interval: 'MONTHLY' });
    prisma.subscription.create.mockResolvedValue({ id: 'sub1' });
  });

  it('charges the plan price, whatever amount is sent', async () => {
    prisma.plan.findFirst.mockResolvedValue({ id: 'pro', name: 'Pro', priceAmount: 1500, currency: 'ETB' });
    prisma.payment.create.mockResolvedValue(record());
    await service.createManualPayment('u1', { planId: 'pro', amount: 1, currency: 'ETB' });
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 1500, metadata: { planId: 'pro' } }) }),
    );
  });

  it('refuses a plan transfer while a PayPal subscription is still renewing', async () => {
    prisma.plan.findFirst.mockResolvedValue({ id: 'pro', name: 'Pro', priceAmount: 1500, currency: 'ETB' });
    prisma.subscription.findFirst.mockResolvedValueOnce({ id: 'sub-pp' });
    await expect(service.createManualPayment('u1', { planId: 'pro' })).rejects.toThrow('renews through PayPal');
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('starts the plan when the transfer is approved', async () => {
    prisma.payment.findUnique.mockResolvedValue(record());
    prisma.subscription.findFirst.mockResolvedValue(null);
    await service.approvePayment('p1', 'admin');
    expect(prisma.subscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', status: { in: ['ACTIVE', 'PAST_DUE'] } } }),
    );
    expect(prisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', planId: 'pro', status: 'ACTIVE', provider: 'MANUAL' }) }),
    );
  });

  it('adds a period when the same plan is already running', async () => {
    const end = new Date('2026-12-15T00:00:00Z');
    prisma.payment.findUnique.mockResolvedValue(record());
    prisma.subscription.findFirst.mockResolvedValue({ id: 'sub0', currentPeriodEnd: end });
    await service.approvePayment('p1', 'admin');
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub0' }, data: expect.objectContaining({ currentPeriodEnd: new Date('2027-01-15T00:00:00Z') }) }),
    );
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it('does not start a plan twice when two admins approve together', async () => {
    prisma.payment.findUnique.mockResolvedValue(record());
    prisma.payment.updateMany.mockResolvedValue({ count: 0 });
    prisma.payment.findUniqueOrThrow.mockResolvedValue(record({ status: 'SUCCEEDED' }));
    await service.approvePayment('p1', 'admin');
    expect(prisma.subscription.create).not.toHaveBeenCalled();
  });

  it("hides someone else's payment", async () => {
    prisma.payment.findUnique.mockResolvedValue(record({ userId: 'owner' }));
    await expect(service.findOne('p1', 'intruder')).rejects.toThrow('not found');
    await expect(service.findOne('p1', 'admin', true)).resolves.toMatchObject({ id: 'p1' });
  });
});
