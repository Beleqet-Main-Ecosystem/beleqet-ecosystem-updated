import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { PaymentGatewayService } from './payment-gateway.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('PaymentGatewayService', () => {
  let service: PaymentGatewayService;
  let prisma: PrismaService;

  const mockPrisma = {
    paymentGateway: {
      findFirst: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'STRIPE_SECRET_KEY') return 'sk_test_dummy';
      return undefined;
    }),
  };

  const mockI18n = {
    translate: jest.fn().mockResolvedValue('Translated error message'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentGatewayService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: I18nService, useValue: mockI18n },
      ],
    }).compile();

    service = module.get<PaymentGatewayService>(PaymentGatewayService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPayment', () => {
    const createDto: CreatePaymentDto = {
      amount: 100.0,
      currency: 'USD',
      provider: 'stripe',
      type: TransactionType.PAYMENT,
      description: 'Test payment',
      consentGiven: true,
      userId: 'user-123',
    };

    it('should create a transaction with valid data', async () => {
      mockPrisma.paymentGateway.findFirst.mockResolvedValue({
        id: 'gateway-1',
        provider: 'stripe',
        supportedCurrencies: ['USD', 'ETB'],
      });

      mockPrisma.transaction.create.mockResolvedValue({
        id: 'tx-1',
        gatewayId: 'gateway-1',
        userId: 'user-123',
        amount: 11750.0,
        currency: 'ETB',
        originalAmount: 100.0,
        originalCurrency: 'USD',
        exchangeRate: 117.5,
        exchangeRateSource: 'internal',
        status: TransactionStatus.PENDING,
        type: TransactionType.PAYMENT,
        description: 'Test payment',
        consentGiven: true,
        consentTimestamp: new Date(),
        metadata: { locale: 'en' },
        ipAddress: null,
        userAgent: null,
        refundedAmount: null,
        refundedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createPayment(createDto, 'en');

      expect(result).toBeDefined();
      expect(result.originalAmount).toBe(100.0);
      expect(result.originalCurrency).toBe('USD');
      expect(result.currency).toBe('ETB');
      expect(result.status).toBe(TransactionStatus.PENDING);
      expect(mockPrisma.transaction.create).toHaveBeenCalled();
    });

    it('should reject unsupported currency', async () => {
      const invalidDto = { ...createDto, currency: 'XYZ' };

      await expect(service.createPayment(invalidDto, 'en')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject payment without GDPR consent', async () => {
      const noConsentDto = { ...createDto, consentGiven: false };

      mockPrisma.paymentGateway.findFirst.mockResolvedValue({
        id: 'gateway-1',
        provider: 'stripe',
        supportedCurrencies: ['USD'],
      });

      await expect(service.createPayment(noConsentDto, 'en')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject inactive gateway', async () => {
      mockPrisma.paymentGateway.findFirst.mockResolvedValue(null);

      await expect(service.createPayment(createDto, 'en')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('convertAmount', () => {
    it('should convert USD to ETB correctly', () => {
      const result = service.convertAmount(100, 'USD', 'ETB');

      expect(result.originalAmount).toBe(100);
      expect(result.originalCurrency).toBe('USD');
      expect(result.targetCurrency).toBe('ETB');
      expect(result.exchangeRate).toBe(117.5);
      expect(result.convertedAmount).toBeCloseTo(11750, 0);
    });

    it('should return same amount for same currency', () => {
      const result = service.convertAmount(100, 'USD', 'USD');

      expect(result.convertedAmount).toBe(100);
      expect(result.exchangeRate).toBe(1);
    });

    it('should throw for unsupported currency pair', () => {
      expect(() => service.convertAmount(100, 'XYZ', 'USD')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('formatCurrency', () => {
    it('should format USD correctly in English', () => {
      const formatted = service.formatCurrency(1234.56, 'USD', 'en');
      expect(formatted).toContain('$');
      expect(formatted).toContain('1,234.56');
    });

    it('should format ETB correctly', () => {
      const formatted = service.formatCurrency(1000, 'ETB', 'en');
      expect(formatted).toContain('ETB');
    });
  });

  describe('refundPayment', () => {
    const refundDto: RefundPaymentDto = {
      transactionId: 'tx-1',
      amount: 50.0,
      reason: 'Customer request',
    };

    it('should process partial refund', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        gatewayId: 'gateway-1',
        gateway: { provider: 'stripe' },
        userId: 'user-123',
        originalAmount: 100.0,
        originalCurrency: 'USD',
        status: TransactionStatus.COMPLETED,
        refundedAmount: 0,
        providerTransactionId: 'pi_123',
      });

      mockPrisma.transaction.update.mockResolvedValue({
        id: 'tx-1',
        status: TransactionStatus.COMPLETED,
        refundedAmount: 50.0,
        refundedAt: new Date(),
      });

      const result = await service.refundPayment(refundDto, 'en');

      expect(result.refundedAmount).toBe(50.0);
      expect(result.status).toBe(TransactionStatus.COMPLETED);
    });

    it('should reject refund for non-completed transaction', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        status: TransactionStatus.PENDING,
      });

      await expect(service.refundPayment(refundDto, 'en')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject refund exceeding original amount', async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 'tx-1',
        gateway: { provider: 'stripe' },
        originalAmount: 100.0,
        status: TransactionStatus.COMPLETED,
        refundedAmount: 60.0,
      });

      const excessiveRefund = { ...refundDto, amount: 50.0 };

      await expect(service.refundPayment(excessiveRefund, 'en')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('exportUserPaymentData (GDPR)', () => {
    it('should export all user payment data', async () => {
      const mockTransactions = [
        {
          id: 'tx-1',
          gatewayId: 'g1',
          userId: 'user-123',
          amount: 100.0,
          currency: 'ETB',
          originalAmount: 100.0,
          originalCurrency: 'ETB',
          status: TransactionStatus.COMPLETED,
          type: TransactionType.PAYMENT,
          consentGiven: true,
          consentTimestamp: new Date('2026-01-01'),
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          refundedAmount: null,
          refundedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);

      const result = await service.exportUserPaymentData('user-123');

      expect(result.userId).toBe('user-123');
      expect(result.totalTransactions).toBe(1);
      expect(result.totalAmountPaid).toHaveProperty('ETB');
      expect(result.consentHistory).toHaveLength(1);
      expect(result.transactions).toHaveLength(1);
      expect(result.exportedAt).toBeDefined();
    });
  });

  describe('deleteUserPaymentData (GDPR)', () => {
    it('should anonymize user payment data', async () => {
      const mockTransactions = [
        { id: 'tx-1', userId: 'user-123' },
        { id: 'tx-2', userId: 'user-123' },
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);
      mockPrisma.transaction.update.mockResolvedValue({});

      const result = await service.deleteUserPaymentData('user-123');

      expect(result.anonymizedCount).toBe(2);
      expect(result.deletedCount).toBe(0);
      expect(mockPrisma.transaction.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('findTransactions', () => {
    it('should filter transactions by status', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      await service.findTransactions({ status: TransactionStatus.COMPLETED }, 'en');

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: TransactionStatus.COMPLETED }),
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should filter transactions by date range', async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([]);

      await service.findTransactions(
        { startDate: '2026-01-01', endDate: '2026-12-31' },
        'en',
      );

      expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });
});
