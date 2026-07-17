import { Test, TestingModule } from '@nestjs/testing';
import { WebhookQueueProcessor } from './webhook.processor';
import { WebhookProcessorService } from '../services/webhook-processor.service';
import { WebhookRetryService } from '../services/webhook-retry.service';
import { PaymentProvider, WebhookEventType } from '../types/webhook.types';
import { Job } from 'bullmq';

describe('WebhookQueueProcessor', () => {
  let processor: WebhookQueueProcessor;
  let processorService: jest.Mocked<WebhookProcessorService>;
  let retryService: jest.Mocked<WebhookRetryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookQueueProcessor,
        {
          provide: WebhookProcessorService,
          useValue: {
            processWebhook: jest.fn(),
          },
        },
        {
          provide: WebhookRetryService,
          useValue: {
            markAsProcessed: jest.fn(),
            markAsFailed: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<WebhookQueueProcessor>(WebhookQueueProcessor);
    processorService = module.get(WebhookProcessorService) as jest.Mocked<WebhookProcessorService>;
    retryService = module.get(WebhookRetryService) as jest.Mocked<WebhookRetryService>;
  });

  describe('processStripe', () => {
    it('should process Stripe webhook successfully', async () => {
      const mockJob = {
        id: 'job_123',
        data: {
          provider: PaymentProvider.STRIPE,
          eventType: WebhookEventType.PAYMENT_SUCCESS,
          payload: { id: 'evt_123', type: 'charge.succeeded' },
          idempotencyKey: 'evt_123',
          attempt: 0,
        },
        updateProgress: jest.fn(),
      } as any as Job;

      processorService.processWebhook.mockResolvedValue(undefined);
      retryService.markAsProcessed.mockResolvedValue(undefined);

      await processor.processStripe(mockJob);

      expect(processorService.processWebhook).toHaveBeenCalled();
      expect(retryService.markAsProcessed).toHaveBeenCalled();
    });

    it('should mark as failed on processing error', async () => {
      const mockJob = {
        id: 'job_123',
        data: {
          provider: PaymentProvider.STRIPE,
          eventType: WebhookEventType.PAYMENT_SUCCESS,
          payload: { id: 'evt_123' },
          idempotencyKey: 'evt_123',
          attempt: 0,
        },
        updateProgress: jest.fn(),
      } as any as Job;

      const error = new Error('Processing failed');
      processorService.processWebhook.mockRejectedValue(error);
      retryService.markAsFailed.mockResolvedValue(undefined);

      await expect(processor.processStripe(mockJob)).rejects.toThrow('Processing failed');
    });
  });

  describe('processPayPal', () => {
    it('should process PayPal webhook successfully', async () => {
      const mockJob = {
        id: 'job_456',
        data: {
          provider: PaymentProvider.PAYPAL,
          eventType: WebhookEventType.PAYMENT_SUCCESS,
          payload: { id: 'WH_123', event_type: 'PAYMENT.CAPTURE.COMPLETED' },
          idempotencyKey: 'WH_123',
          attempt: 0,
        },
        updateProgress: jest.fn(),
      } as any as Job;

      processorService.processWebhook.mockResolvedValue(undefined);
      retryService.markAsProcessed.mockResolvedValue(undefined);

      await processor.processPayPal(mockJob);

      expect(processorService.processWebhook).toHaveBeenCalled();
    });
  });

  describe('processChapa', () => {
    it('should process Chapa webhook successfully', async () => {
      const mockJob = {
        id: 'job_789',
        data: {
          provider: PaymentProvider.CHAPA,
          eventType: WebhookEventType.PAYMENT_SUCCESS,
          payload: { event: 'charge.success', data: { reference: 'ref_123' } },
          idempotencyKey: 'ref_123',
          attempt: 0,
        },
        updateProgress: jest.fn(),
      } as any as Job;

      processorService.processWebhook.mockResolvedValue(undefined);
      retryService.markAsProcessed.mockResolvedValue(undefined);

      await processor.processChapa(mockJob);

      expect(processorService.processWebhook).toHaveBeenCalled();
    });
  });

  describe('processRetry', () => {
    it('should retry failed webhook processing', async () => {
      const mockJob = {
        id: 'job_retry',
        data: {
          provider: PaymentProvider.STRIPE,
          eventType: WebhookEventType.PAYMENT_SUCCESS,
          payload: { id: 'evt_retry' },
          idempotencyKey: 'evt_retry',
          attempt: 1,
        },
        updateProgress: jest.fn(),
        attempts: 5,
        attemptsStarted: 2,
      } as any as Job;

      processorService.processWebhook.mockResolvedValue(undefined);
      retryService.markAsProcessed.mockResolvedValue(undefined);

      await processor.processRetry(mockJob);

      expect(processorService.processWebhook).toHaveBeenCalled();
    });

    it('should mark as failed after max attempts', async () => {
      const mockJob = {
        id: 'job_failed',
        data: {
          provider: PaymentProvider.STRIPE,
          eventType: WebhookEventType.PAYMENT_SUCCESS,
          payload: { id: 'evt_failed' },
          idempotencyKey: 'evt_failed',
          attempt: 4,
        },
        updateProgress: jest.fn(),
        attempts: 5,
        attemptsStarted: 5,
      } as any as Job;

      const error = new Error('Max retries exceeded');
      processorService.processWebhook.mockRejectedValue(error);

      await expect(processor.processRetry(mockJob)).rejects.toThrow();
    });
  });

  describe('Job processing flow', () => {
    it('should track job progress', async () => {
      const mockJob = {
        id: 'job_progress',
        data: {
          provider: PaymentProvider.STRIPE,
          eventType: WebhookEventType.PAYMENT_SUCCESS,
          payload: { id: 'evt_progress' },
          idempotencyKey: 'evt_progress',
          attempt: 0,
        },
        updateProgress: jest.fn(),
      } as any as Job;

      processorService.processWebhook.mockResolvedValue(undefined);
      retryService.markAsProcessed.mockResolvedValue(undefined);

      await processor.processStripe(mockJob);

      expect(mockJob.updateProgress).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'processing' }),
      );
    });
  });
});
