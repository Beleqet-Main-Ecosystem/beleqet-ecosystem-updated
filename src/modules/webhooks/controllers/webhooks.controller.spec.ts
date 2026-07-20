import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhookVerifierService } from '../services/webhook-verifier.service';
import { WebhookRetryService } from '../services/webhook-retry.service';
import { WebhookProcessorService } from '../services/webhook-processor.service';
import { PaymentProvider, WebhookEventType, WebhookVerificationResult } from '../types/webhook.types';
import { Request } from 'express';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let verifierService: jest.Mocked<WebhookVerifierService>;
  let retryService: jest.Mocked<WebhookRetryService>;
  let processorService: jest.Mocked<WebhookProcessorService>;

  const mockVerificationResult: WebhookVerificationResult = {
    isValid: true,
    provider: PaymentProvider.STRIPE,
    eventType: WebhookEventType.PAYMENT_SUCCESS,
    payload: { id: 'evt_123', type: 'charge.succeeded' },
    timestamp: new Date(),
    idempotencyKey: 'evt_123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: WebhookVerifierService,
          useValue: {
            verifyStripe: jest.fn(),
            verifyPayPal: jest.fn(),
            verifyChapa: jest.fn(),
          },
        },
        {
          provide: WebhookRetryService,
          useValue: {
            enqueueWebhook: jest.fn(),
            checkStatus: jest.fn(),
            getRetryHistory: jest.fn(),
          },
        },
        {
          provide: WebhookProcessorService,
          useValue: {
            processWebhook: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    verifierService = module.get(WebhookVerifierService) as jest.Mocked<WebhookVerifierService>;
    retryService = module.get(WebhookRetryService) as jest.Mocked<WebhookRetryService>;
    processorService = module.get(WebhookProcessorService) as jest.Mocked<WebhookProcessorService>;
  });

  describe('handleStripe', () => {
    it('should successfully process a Stripe webhook', async () => {
      const mockRequest = {
        rawBody: Buffer.from(JSON.stringify({ id: 'evt_123' })),
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as any;

      verifierService.verifyStripe.mockResolvedValue(mockVerificationResult);
      retryService.enqueueWebhook.mockResolvedValue('job_123');
      processorService.processWebhook.mockResolvedValue(undefined);

      const result = await controller.handleStripe(mockRequest, 't=123,v1=abc', '');

      expect(result).toEqual({
        received: true,
        jobId: 'job_123',
        provider: PaymentProvider.STRIPE,
      });
      expect(verifierService.verifyStripe).toHaveBeenCalled();
      expect(retryService.enqueueWebhook).toHaveBeenCalled();
      expect(processorService.processWebhook).toHaveBeenCalled();
    });

    it('should throw BadRequestException on invalid signature', async () => {
      const mockRequest = {
        rawBody: Buffer.from(JSON.stringify({ id: 'evt_123' })),
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as any;

      verifierService.verifyStripe.mockRejectedValue(
        new BadRequestException('Stripe signature verification failed'),
      );

      await expect(controller.handleStripe(mockRequest, 'invalid', '')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('handlePayPal', () => {
    it('should successfully process a PayPal webhook', async () => {
      const mockRequest = { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as any;
      const payload = { id: 'WH_123', event_type: 'PAYMENT.CAPTURE.COMPLETED' };

      verifierService.verifyPayPal.mockResolvedValue({
        ...mockVerificationResult,
        provider: PaymentProvider.PAYPAL,
      });
      retryService.enqueueWebhook.mockResolvedValue('job_456');
      processorService.processWebhook.mockResolvedValue(undefined);

      const result = await controller.handlePayPal(
        payload,
        'transmission_123',
        '2024-01-01T00:00:00Z',
        'https://api.paypal.com/cert',
        'signature_123',
        '',
        mockRequest,
      );

      expect(result).toEqual({
        received: true,
        jobId: 'job_456',
        provider: PaymentProvider.PAYPAL,
      });
      expect(verifierService.verifyPayPal).toHaveBeenCalled();
    });

    it('should throw BadRequestException on verification failure', async () => {
      const mockRequest = { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as any;
      const payload = { id: 'WH_123' };

      verifierService.verifyPayPal.mockRejectedValue(
        new BadRequestException('PayPal signature verification failed'),
      );

      await expect(
        controller.handlePayPal(payload, 'tx_123', '2024-01-01T00:00:00Z', 'url', 'sig', '', mockRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleChapa', () => {
    it('should successfully process a Chapa webhook', async () => {
      const mockRequest = { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as any;
      const payload = { event: 'charge.success', data: { reference: 'ref_123' } };

      verifierService.verifyChapa.mockResolvedValue({
        ...mockVerificationResult,
        provider: PaymentProvider.CHAPA,
      });
      retryService.enqueueWebhook.mockResolvedValue('job_789');
      processorService.processWebhook.mockResolvedValue(undefined);

      const result = await controller.handleChapa(payload, 'signature_123', '', mockRequest);

      expect(result).toEqual({
        received: true,
        jobId: 'job_789',
        provider: PaymentProvider.CHAPA,
      });
    });

    it('should throw BadRequestException on invalid Chapa signature', async () => {
      const mockRequest = { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } } as any;
      const payload = { event: 'charge.success' };

      verifierService.verifyChapa.mockRejectedValue(
        new BadRequestException('Chapa signature verification failed'),
      );

      await expect(controller.handleChapa(payload, 'invalid', '', mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('checkStatus', () => {
    it('should return webhook processing status', async () => {
      const mockStatus = {
        status: 'completed' as const,
        attempt: 1,
        nextRetry: undefined,
      };
      retryService.checkStatus.mockResolvedValue(mockStatus);

      const result = await controller.checkStatus('job_123');

      expect(result).toEqual(mockStatus);
      expect(retryService.checkStatus).toHaveBeenCalledWith('job_123');
    });
  });

  describe('getRetryHistory', () => {
    it('should return retry history for a webhook', async () => {
      const mockHistory = [
        { 
          id: 'log_1', 
          statusCode: 500, 
          error: 'Database timeout', 
          retryCount: 1,
          retryUntil: new Date('2024-01-01T12:00:00Z'),
          processedAt: null,
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        { 
          id: 'log_2', 
          statusCode: 200, 
          error: null, 
          retryCount: 2,
          retryUntil: null,
          processedAt: new Date('2024-01-01T10:05:00Z'),
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];
      retryService.getRetryHistory.mockResolvedValue(mockHistory);

      const result = await controller.getRetryHistory('evt_123');

      expect(result).toEqual(mockHistory);
      expect(retryService.getRetryHistory).toHaveBeenCalledWith('evt_123');
    });
  });
});
