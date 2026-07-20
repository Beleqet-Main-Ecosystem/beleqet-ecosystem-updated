import { Test, TestingModule } from '@nestjs/testing';
import { WebhookRetryService } from './webhook-retry.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { PaymentProvider, WebhookEventType } from '../types/webhook.types';

describe('WebhookRetryService', () => {
  let service: WebhookRetryService;
  let prismaService: any;
  let mockQueue: jest.Mocked<Queue>;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job_123' }),
      getJob: jest.fn().mockResolvedValue(null),
    } as any;

    const mockPrisma = {
      webhookLog: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookRetryService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: getQueueToken('webhooks'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<WebhookRetryService>(WebhookRetryService);
    prismaService = mockPrisma;
  });

  describe('enqueueWebhook', () => {
    it('should enqueue a new webhook', async () => {
      const payload = { id: 'evt_123', type: 'charge.succeeded' };
      const idempotencyKey = 'evt_123';

      prismaService.webhookLog.findUnique.mockResolvedValue(null);
      mockQueue.add.mockResolvedValue({ id: 'job_123' } as any);

      const jobId = await service.enqueueWebhook(
        PaymentProvider.STRIPE,
        WebhookEventType.PAYMENT_SUCCESS,
        payload,
        idempotencyKey,
      );

      expect(jobId).toBe('job_123');
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should return existing job ID if webhook already processed (idempotency)', async () => {
      const existingLog = {
        id: 'log_123',
        idempotencyKey: 'evt_123',
        processedAt: new Date(),
      };

      prismaService.webhookLog.findUnique.mockResolvedValue(existingLog);

      const jobId = await service.enqueueWebhook(
        PaymentProvider.STRIPE,
        WebhookEventType.PAYMENT_SUCCESS,
        {},
        'evt_123',
      );

      expect(jobId).toBe('log_123');
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('calculateBackoffDelay', () => {
    it('should calculate exponential backoff delays correctly', () => {
      const defaultConfig = {
        maxRetries: 5,
        initialDelayMs: 1000,
        backoffMultiplier: 2,
        maxDelayMs: 300000,
      };

      const delay0 = service.calculateBackoffDelay(0, defaultConfig);
      const delay1 = service.calculateBackoffDelay(1, defaultConfig);
      const delay2 = service.calculateBackoffDelay(2, defaultConfig);
      const delay4 = service.calculateBackoffDelay(4, defaultConfig);

      expect(delay0).toBe(1000);
      expect(delay1).toBe(2000);
      expect(delay2).toBe(4000);
      expect(delay4).toBe(16000);
    });

    it('should respect maximum delay limit', () => {
      const config = {
        maxRetries: 5,
        initialDelayMs: 1000,
        backoffMultiplier: 2,
        maxDelayMs: 5000,
      };

      const delayLarge = service.calculateBackoffDelay(10, config);

      expect(delayLarge).toBeLessThanOrEqual(5000);
    });
  });

  describe('markAsProcessed', () => {
    it('should mark webhook as processed', async () => {
      const webhookId = 'log_123';
      const responseData = { success: true };

      prismaService.webhookLog.update.mockResolvedValue({} as any);

      await service.markAsProcessed(webhookId, responseData);

      expect(prismaService.webhookLog.update).toHaveBeenCalledWith({
        where: { id: webhookId },
        data: expect.objectContaining({
          processedAt: expect.any(Date),
          responseBody: responseData,
        }),
      });
    });
  });

  describe('getRetryHistory', () => {
    it('should retrieve retry history for a webhook', async () => {
      const mockHistory = [
        { id: 'log_1', statusCode: 500, error: 'Database timeout' },
        { id: 'log_2', statusCode: 200, error: null },
      ];

      prismaService.webhookLog.findMany.mockResolvedValue(mockHistory as any);

      const result = await service.getRetryHistory('evt_123');

      expect(result).toEqual(mockHistory);
      expect(prismaService.webhookLog.findMany).toHaveBeenCalledWith({
        where: { idempotencyKey: 'evt_123' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          statusCode: true,
          error: true,
          retryCount: true,
          retryUntil: true,
          processedAt: true,
          createdAt: true,
        },
      });
    });
  });

  describe('checkStatus', () => {
    it('should return webhook processing status', async () => {
      const mockJob = {
        id: 'job_123',
        attemptsMade: 1,
        processedOn: Date.now(),
        opts: { delay: 1000 },
        getState: jest.fn().mockResolvedValue('completed'),
      };

      mockQueue.getJob.mockResolvedValue(mockJob as any);

      const result = await service.checkStatus('job_123');

      expect(result).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.attempt).toBe(1);
      expect(mockQueue.getJob).toHaveBeenCalledWith('job_123');
    });
  });
});
