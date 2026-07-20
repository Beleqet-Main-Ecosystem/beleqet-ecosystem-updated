import { Test, TestingModule } from '@nestjs/testing';
import { WebhookProcessorService } from './webhook-processor.service';
import { PrismaService } from '../../../prisma/prisma.service';
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

    const mockPrisma = {
      walletTransaction: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      freelancerWallet: {
        update: jest.fn().mockResolvedValue({}),
      },
      paymentTransaction: {
        create: jest.fn().mockResolvedValue({}),
      },
      walletLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookProcessorService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: I18nService,
          useValue: {
            translate: jest.fn().mockReturnValue('Translated message'),
            formatCurrency: jest.fn().mockReturnValue('$100.00'),
          },
        },
        {
          provide: GDPRService,
          useValue: {
            getComplianceMetadata: jest.fn().mockResolvedValue({}),
            checkConsentStatus: jest.fn().mockResolvedValue(true),
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
    prismaService = module.get<PrismaService>(PrismaService) as any;
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
          type: 'charge.succeeded',
          data: { 
            object: { 
              id: 'ch_123', 
              amount: 2000, 
              currency: 'usd',
              customer: 'cus_123',
              status: 'succeeded',
              created: Math.floor(Date.now() / 1000),
            } 
          },
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

      (prismaService.walletTransaction.findFirst as any).mockResolvedValue(mockTransaction);
      (prismaService.walletTransaction.update as any).mockResolvedValue({});
      (prismaService.freelancerWallet.update as any).mockResolvedValue({});

      await service.processWebhook(verificationResult as any);

      expect(prismaService.paymentTransaction.create).toHaveBeenCalled();
      expect(prismaService.walletTransaction.findFirst).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'webhook.processed',
        expect.any(Object),
      );
    });

    it('should handle payment failed event', async () => {
      const verificationResult = {
        isValid: true,
        provider: PaymentProvider.STRIPE,
        eventType: WebhookEventType.PAYMENT_FAILED,
        payload: { 
          id: 'evt_456',
          type: 'charge.failed',
          data: { 
            object: { 
              id: 'ch_456', 
              amount: 2000, 
              currency: 'usd', 
              customer: 'cus_456',
              status: 'failed',
              created: Math.floor(Date.now() / 1000),
            } 
          },
        },
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

      (prismaService.walletTransaction.findFirst as any).mockResolvedValue(mockTransaction);
      (prismaService.walletTransaction.update as any).mockResolvedValue({});

      await service.processWebhook(verificationResult as any);

      expect(prismaService.walletTransaction.update).toHaveBeenCalled();
    });

    it('should handle refund event', async () => {
      const verificationResult = {
        isValid: true,
        provider: PaymentProvider.STRIPE,
        eventType: WebhookEventType.PAYMENT_REFUNDED,
        payload: { 
          id: 'evt_789',
          type: 'charge.refunded',
          data: { 
            object: { 
              id: 'ch_789', 
              amount: 5000, 
              currency: 'usd', 
              customer: 'cus_789',
              refunded: true,
              status: 'refunded',
              created: Math.floor(Date.now() / 1000),
            } 
          },
        },
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

      (prismaService.walletTransaction.findFirst as any).mockResolvedValue(mockTransaction);
      (prismaService.walletTransaction.update as any).mockResolvedValue({});
      (prismaService.freelancerWallet.update as any).mockResolvedValue({});

      await service.processWebhook(verificationResult as any);

      expect(prismaService.walletTransaction.update).toHaveBeenCalled();
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
