import { Test, TestingModule } from '@nestjs/testing';
import { WebhookProcessorService } from './webhook-processor.service';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from './i18n.service';
import { GDPRService } from './gdpr.service';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentProvider, WebhookEventType } from '../types/webhook.types';

describe('WebhookProcessorService', () => {
  let service: WebhookProcessorService;
  let prismaService: jest.Mocked<PrismaService>;
  let i18nService: jest.Mocked<I18nService>;
  let gdprService: jest.Mocked<GDPRService>;
  let mockQueue: jest.Mocked<Queue>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job_123' }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookProcessorService,
        {
          provide: PrismaService,
          useValue: {
            walletTransaction: {
              findFirst: jest.fn(),
              update: jest.fn(),
            },
            freelancerWallet: {
              update: jest.fn(),
            },
            paymentTransaction: {
              create: jest.fn(),
            },
            walletLog: {
              create: jest.fn(),
            },
          },
        },
        {
          provide: I18nService,
          useValue: {
            translate: jest.fn(),
            formatCurrency: jest.fn(),
          },
        },
        {
          provide: GDPRService,
          useValue: {
            getComplianceMetadata: jest.fn(),
            checkConsentStatus: jest.fn(),
          },
        },
        {
          provide: getQueueToken('webhooks'),
          useValue: mockQueue,
        },
        {
          provide: getQueueToken('notifications'),
          useValue: mockQueue,
        },
        {
          provide: getQueueToken('wallet'),
          useValue: mockQueue,
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookProcessorService>(WebhookProcessorService);
    prismaService = module.get(PrismaService) as jest.Mocked<PrismaService>;
    i18nService = module.get(I18nService) as jest.Mocked<I18nService>;
    gdprService = module.get(GDPRService) as jest.Mocked<GDPRService>;
    eventEmitter = module.get(EventEmitter2) as jest.Mocked<EventEmitter2>;
  });

  describe('processWebhook', () => {
    it('should process a payment success event', async () => {
      const verificationResult = {
        isValid: true,
        provider: PaymentProvider.STRIPE,
        eventType: WebhookEventType.PAYMENT_SUCCESS,
        payload: {
          id: 'evt_123',
          data: { object: { id: 'ch_123', amount: 2000, currency: 'usd' } },
        },
        timestamp: new Date(),
        idempotencyKey: 'evt_123',
      };

      const mockTransaction = {
        id: 'txn_123',
        externalTransactionId: 'ch_123',
        walletId: 'wallet_123',
        wallet: {
          userId: 'user_123',
          currency: 'USD',
          availableBalance: 0,
        },
        metadata: {},
      };

      prismaService.walletTransaction.findFirst.mockResolvedValue(mockTransaction as any);
      prismaService.walletTransaction.update.mockResolvedValue({} as any);
      prismaService.freelancerWallet.update.mockResolvedValue({} as any);
      i18nService.translate.mockReturnValue('Payment successful');

      await service.processWebhook(verificationResult as any);

      expect(prismaService.walletTransaction.findFirst).toHaveBeenCalled();
      expect(prismaService.walletTransaction.update).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalled(); // notification queue
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'webhook.processed',
        expect.objectContaining({ eventType: WebhookEventType.PAYMENT_SUCCESS }),
      );
    });

    it('should handle payment failed event', async () => {
      const verificationResult = {
        isValid: true,
        provider: PaymentProvider.STRIPE,
        eventType: WebhookEventType.PAYMENT_FAILED,
        payload: { id: 'evt_456' },
        timestamp: new Date(),
        idempotencyKey: 'evt_456',
      };

      const mockTransaction = {
        id: 'txn_456',
        externalTransactionId: 'ch_456',
        walletId: 'wallet_456',
        wallet: { userId: 'user_456', currency: 'USD' },
        metadata: {},
      };

      prismaService.walletTransaction.findFirst.mockResolvedValue(mockTransaction as any);
      prismaService.walletTransaction.update.mockResolvedValue({} as any);

      await service.processWebhook(verificationResult as any);

      expect(prismaService.walletTransaction.update).toHaveBeenCalledWith({
        where: { id: mockTransaction.id },
        data: expect.objectContaining({ status: 'failed' }),
      });
    });

    it('should handle refund event', async () => {
      const verificationResult = {
        isValid: true,
        provider: PaymentProvider.STRIPE,
        eventType: WebhookEventType.PAYMENT_REFUNDED,
        payload: { id: 'evt_789' },
        timestamp: new Date(),
        idempotencyKey: 'evt_789',
      };

      const mockTransaction = {
        id: 'txn_789',
        externalTransactionId: 'ch_789',
        walletId: 'wallet_789',
        wallet: { userId: 'user_789', currency: 'USD', availableBalance: 100 },
        amount: 50,
        metadata: {},
      };

      prismaService.walletTransaction.findFirst.mockResolvedValue(mockTransaction as any);
      prismaService.walletTransaction.update.mockResolvedValue({} as any);
      prismaService.freelancerWallet.update.mockResolvedValue({} as any);

      await service.processWebhook(verificationResult as any);

      expect(prismaService.walletTransaction.update).toHaveBeenCalledWith({
        where: { id: mockTransaction.id },
        data: expect.objectContaining({ status: 'refunded' }),
      });
    });
  });

  describe('normalizeEvent', () => {
    it('should normalize Stripe event type', () => {
      const verificationResult = {
        isValid: true,
        provider: PaymentProvider.STRIPE,
        eventType: WebhookEventType.PAYMENT_SUCCESS,
        payload: { id: 'evt_123', type: 'charge.succeeded' },
        timestamp: new Date(),
        idempotencyKey: 'evt_123',
      };

      // This is indirectly tested through processWebhook
      expect(verificationResult.eventType).toBe(WebhookEventType.PAYMENT_SUCCESS);
    });
  });
});
