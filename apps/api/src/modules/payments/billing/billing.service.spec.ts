import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnprocessableEntityException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { BillingService } from './billing.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { WalletService } from '../wallet/wallet.service';
import { GenericBillingWebhookDto } from './dto/generic-billing-webhook.dto';

describe('BillingService', () => {
  let service: BillingService;
  let subscriptionsService: { syncFromProviderEvent: jest.Mock };
  let walletService: { convertCurrency: jest.Mock };
  const secret = 'test-billing-secret';

  const buildModule = async (webhookSecret: string) => {
    subscriptionsService = { syncFromProviderEvent: jest.fn() };
    walletService = { convertCurrency: jest.fn() };
    const config = {
      get: jest.fn((key: string) => (key === 'BILLING_WEBHOOK_SECRET' ? webhookSecret : undefined)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: SubscriptionsService, useValue: subscriptionsService },
        { provide: WalletService, useValue: walletService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  };

  describe('handleSubscriptionLifecycleEvent', () => {
    it('forwards the event straight to SubscriptionsService.syncFromProviderEvent', async () => {
      await buildModule(secret);
      const payload = {
        gatewayEventId: 'evt-1',
        provider: 'PAYPAL' as const,
        eventType: 'ACTIVATED' as const,
        providerSubscriptionId: 'I-AGREEMENT',
      };

      await service.handleSubscriptionLifecycleEvent(payload);

      expect(subscriptionsService.syncFromProviderEvent).toHaveBeenCalledWith(payload);
    });
  });

  describe('convertToPlanCurrency', () => {
    it('delegates to WalletService.convertCurrency', async () => {
      await buildModule(secret);
      walletService.convertCurrency.mockReturnValue(1250);

      const result = service.convertToPlanCurrency(10, 'USD', 'ETB');

      expect(walletService.convertCurrency).toHaveBeenCalledWith(10, 'USD', 'ETB');
      expect(result).toBe(1250);
    });
  });

  describe('handleGenericWebhook', () => {
    const dto: GenericBillingWebhookDto = {
      gatewayEventId: 'evt-1',
      provider: 'PAYPAL' as const,
      eventType: 'ACTIVATED',
      providerSubscriptionId: 'I-AGREEMENT',
    };

    const rawBody = Buffer.from(JSON.stringify(dto));

    it('rejects a missing/invalid signature when a secret is configured', async () => {
      await buildModule(secret);
      await expect(
        service.handleGenericWebhook(dto, rawBody, 'not-the-right-signature'),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(subscriptionsService.syncFromProviderEvent).not.toHaveBeenCalled();
    });

    it('accepts a valid HMAC signature and syncs the subscription', async () => {
      await buildModule(secret);
      const signature = createHmac('sha256', secret).update(rawBody).digest('hex');

      await service.handleGenericWebhook(dto, rawBody, signature);

      expect(subscriptionsService.syncFromProviderEvent).toHaveBeenCalledWith(
        expect.objectContaining({ gatewayEventId: 'evt-1', providerSubscriptionId: 'I-AGREEMENT' }),
      );
    });

    it('accepts a signature computed over raw bytes that reformat the same JSON (proves it no longer re-serializes the parsed DTO)', async () => {
      await buildModule(secret);
      const differentlyFormattedRawBody = Buffer.from(
        `{\n  "gatewayEventId":   "evt-1",\n  "provider": "PAYPAL",\n  "eventType": "ACTIVATED",\n  "providerSubscriptionId": "I-AGREEMENT"\n}`,
      );
      const signature = createHmac('sha256', secret)
        .update(differentlyFormattedRawBody)
        .digest('hex');

      await service.handleGenericWebhook(dto, differentlyFormattedRawBody, signature);

      expect(subscriptionsService.syncFromProviderEvent).toHaveBeenCalled();
    });

    it('skips verification (with a warning) when no secret is configured', async () => {
      await buildModule('');
      await service.handleGenericWebhook(dto, rawBody, undefined);
      expect(subscriptionsService.syncFromProviderEvent).toHaveBeenCalled();
    });
  });
});
