import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookVerifierService } from './webhook-verifier.service';
import { PaymentProvider, WebhookEventType } from '../types/webhook.types';
import * as crypto from 'crypto';

describe('WebhookVerifierService', () => {
  let service: WebhookVerifierService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookVerifierService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookVerifierService>(WebhookVerifierService);
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  describe('verifyStripe', () => {
    it('should verify a valid Stripe signature', async () => {
      const secret = 'test_secret_123';
      const timestamp = Math.floor(Date.now() / 1000);
      const body = Buffer.from(JSON.stringify({ id: 'evt_123', type: 'charge.succeeded' }));
      const signedContent = `${timestamp}.${body.toString()}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedContent)
        .digest('hex');
      const stripeSignature = `t=${timestamp},v1=${expectedSignature}`;

      configService.get.mockReturnValue(secret);

      const result = await service.verifyStripe(body, stripeSignature, timestamp);

      expect(result.isValid).toBe(true);
      expect(result.provider).toBe(PaymentProvider.STRIPE);
      expect(result.eventType).toBe(WebhookEventType.PAYMENT_SUCCESS);
      expect(result.idempotencyKey).toBe('evt_123');
    });

    it('should throw error on invalid Stripe signature', async () => {
      const secret = 'test_secret_123';
      const timestamp = Math.floor(Date.now() / 1000);
      const body = Buffer.from(JSON.stringify({ id: 'evt_123' }));
      const invalidSignature = `t=${timestamp},v1=invalid_signature`;

      configService.get.mockReturnValue(secret);

      await expect(service.verifyStripe(body, invalidSignature, timestamp)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if webhook secret is not configured', async () => {
      configService.get.mockReturnValue(undefined);

      await expect(
        service.verifyStripe(Buffer.from('test'), 't=123,v1=sig', Math.floor(Date.now() / 1000)),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject old timestamps', async () => {
      const secret = 'test_secret_123';
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds old (exceeds 5 min window)
      const body = Buffer.from(JSON.stringify({ id: 'evt_123' }));
      const signedContent = `${oldTimestamp}.${body.toString()}`;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(signedContent)
        .digest('hex');
      const stripeSignature = `t=${oldTimestamp},v1=${signature}`;

      configService.get.mockReturnValue(secret);

      await expect(
        service.verifyStripe(body, stripeSignature, Math.floor(Date.now() / 1000)),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyPayPal', () => {
    it('should verify a valid PayPal signature', async () => {
      const secret = 'paypal_secret_123';
      const webhookId = 'WH_123';
      const transmissionId = 'tx_123';
      const transmissionTime = '2024-01-01T00:00:00Z';
      const payload = { id: 'WH_123', event_type: 'PAYMENT.CAPTURE.COMPLETED' };
      const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      const verificationString = [transmissionId, transmissionTime, webhookId, payloadHash].join('|');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(verificationString)
        .digest('base64');

      configService.get.mockImplementation((key) => {
        if (key === 'PAYPAL_WEBHOOK_ID') return webhookId;
        if (key === 'PAYPAL_WEBHOOK_SECRET') return secret;
        return undefined;
      });

      const result = await service.verifyPayPal(
        payload,
        expectedSignature,
        transmissionId,
        transmissionTime,
        'https://api.paypal.com/cert',
      );

      expect(result.isValid).toBe(true);
      expect(result.provider).toBe(PaymentProvider.PAYPAL);
    });

    it('should throw error on invalid PayPal signature', async () => {
      configService.get.mockImplementation((key) => {
        if (key === 'PAYPAL_WEBHOOK_ID') return 'WH_123';
        if (key === 'PAYPAL_WEBHOOK_SECRET') return 'secret_123';
        return undefined;
      });

      await expect(
        service.verifyPayPal(
          { id: 'WH_123' },
          'invalid_signature',
          'tx_123',
          '2024-01-01T00:00:00Z',
          'https://api.paypal.com/cert',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyChapa', () => {
    it('should verify a valid Chapa signature', async () => {
      const secret = 'chapa_secret_123';
      const payload = { event: 'charge.success', data: { reference: 'ref_123' } };
      const payloadString = JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');

      configService.get.mockReturnValue(secret);

      const result = await service.verifyChapa(payload, expectedSignature);

      expect(result.isValid).toBe(true);
      expect(result.provider).toBe(PaymentProvider.CHAPA);
    });

    it('should throw error on invalid Chapa signature', async () => {
      configService.get.mockReturnValue('chapa_secret_123');

      await expect(
        service.verifyChapa(
          { event: 'charge.success' },
          'invalid_signature',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if Chapa secret is not configured', async () => {
      configService.get.mockReturnValue(undefined);

      await expect(
        service.verifyChapa({ event: 'charge.success' }, 'sig'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
