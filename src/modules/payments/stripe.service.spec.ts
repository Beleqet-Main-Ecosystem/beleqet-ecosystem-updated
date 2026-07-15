/**
 * @file stripe.service.spec.ts
 * @description
 * Unit tests for StripeService — Global Payment Gateway (Task ID: Global-Payments-001).
 *
 * All external I/O (Stripe SDK, Prisma) is fully mocked so no live network
 * calls or DB connections are required.
 *
 * Coverage:
 *  - createPaymentIntent (happy path, validation, error handling)
 *  - confirmPayment (happy path, Stripe errors)
 *  - refund (full & partial, error handling)
 *  - handleWebhook (signature verification, event dispatch)
 *  - listSupportedCurrencies
 *  - PII sanitisation in metadata
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import { StripeService } from './stripe.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─────────────────────────────────────────────────────────────────────────────
// Stripe SDK mock — hoisted before service imports
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('stripe', () => {
  const mockPaymentIntents = {
    create:  jest.fn(),
    confirm: jest.fn(),
  };
  const mockRefunds = { create: jest.fn() };
  const mockWebhooks = { constructEvent: jest.fn() };

  const MockStripe = jest.fn().mockImplementation(() => ({
    paymentIntents: mockPaymentIntents,
    refunds:        mockRefunds,
    webhooks:       mockWebhooks,
  }));

  (MockStripe as any).errors = {
    StripeCardError: class extends Error {
      code = 'card_declined';
      constructor(msg: string) { super(msg); this.name = 'StripeCardError'; }
    },
    StripeInvalidRequestError: class extends Error {
      constructor(msg: string) { super(msg); this.name = 'StripeInvalidRequestError'; }
    },
    StripeError: class extends Error {
      constructor(msg: string) { super(msg); this.name = 'StripeError'; }
    },
  };

  return { __esModule: true, default: MockStripe };
});

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeIntent(
  override: Partial<Stripe.PaymentIntent> = {},
): Stripe.PaymentIntent {
  return {
    id:            'pi_test_001',
    client_secret: 'pi_secret_test_001',
    status:        'requires_payment_method',
    amount:        5000,
    currency:      'usd',
    created:       1_700_000_000,
    ...override,
  } as Stripe.PaymentIntent;
}

function makeRefund(override: Partial<Stripe.Refund> = {}): Stripe.Refund {
  return {
    id:             're_test_001',
    status:         'succeeded',
    amount:         5000,
    currency:       'usd',
    payment_intent: 'pi_test_001',
    created:        1_700_000_001,
    ...override,
  } as unknown as Stripe.Refund;
}

function makeWebhookEvent(type: string, data: Record<string, unknown> = {}): Stripe.Event {
  return {
    id:       `evt_${type.replace(/\./g, '_')}`,
    type,
    data:     { object: { id: 'pi_test_001', ...data } },
    created:  1_700_000_000,
    livemode: false,
  } as unknown as Stripe.Event;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock factories
// ─────────────────────────────────────────────────────────────────────────────

function buildMockPrisma() {
  return {
    payment: {
      upsert:     jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaService;
}

function buildMockConfig(extra: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    STRIPE_SECRET_KEY:     'sk_test_mock_key',
    STRIPE_WEBHOOK_SECRET: 'whsec_mock_secret',
    ...extra,
  };
  return {
    getOrThrow: jest.fn((k: string) => {
      if (k in defaults) return defaults[k];
      throw new Error(`Missing config: ${k}`);
    }),
    get: jest.fn((k: string, fb?: string) => defaults[k] ?? fb ?? ''),
  } as unknown as ConfigService;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test module builder
// ─────────────────────────────────────────────────────────────────────────────

async function buildModule(
  configExtra: Record<string, string> = {},
): Promise<{
  service: StripeService;
  prisma:  ReturnType<typeof buildMockPrisma>;
  stripe:  Stripe;
}> {
  const prisma  = buildMockPrisma();
  const config  = buildMockConfig(configExtra);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      StripeService,
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigService, useValue: config },
    ],
  }).compile();

  const service = module.get<StripeService>(StripeService);
  // Access the private stripe instance via type-cast
  const stripe  = (service as unknown as { stripe: Stripe }).stripe;

  return { service, prisma, stripe };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('StripeService', () => {
  let service: StripeService;
  let prisma:  ReturnType<typeof buildMockPrisma>;
  let stripe:  Stripe;

  beforeEach(async () => {
    const ctx = await buildModule();
    service   = ctx.service;
    prisma    = ctx.prisma;
    stripe    = ctx.stripe;
  });

  afterEach(() => jest.clearAllMocks());

  // ──────────────────────────────────────────────────────────────────────────
  // createPaymentIntent
  // ──────────────────────────────────────────────────────────────────────────
  describe('createPaymentIntent', () => {
    it('creates a PaymentIntent and returns the client secret', async () => {
      (stripe.paymentIntents.create as jest.Mock).mockResolvedValue(makeIntent());

      const result = await service.createPaymentIntent({
        amount:   5000,
        currency: 'USD',
        userId:   'user-uuid-001',
      });

      expect(result.id).toBe('pi_test_001');
      expect(result.clientSecret).toBe('pi_secret_test_001');
      expect(result.currency).toBe('USD');
      expect(result.amount).toBe(5000);
      expect(result).toHaveProperty('createdAt');
    });

    it('persists a payment record to the DB after creation', async () => {
      (stripe.paymentIntents.create as jest.Mock).mockResolvedValue(makeIntent());

      await service.createPaymentIntent({
        amount: 5000, currency: 'USD', userId: 'user-uuid-001',
      });

      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            userId:            'user-uuid-001',
            provider:          'STRIPE',
            providerPaymentId: 'pi_test_001',
            currency:          'USD',
            status:            'PENDING',
          }),
        }),
      );
    });

    it('passes description to the Stripe SDK', async () => {
      (stripe.paymentIntents.create as jest.Mock).mockResolvedValue(
        makeIntent({ id: 'pi_with_desc' }),
      );

      await service.createPaymentIntent({
        amount:      2000,
        currency:    'USD',
        userId:      'user-uuid-002',
        description: 'Beleqet job escrow',
      });

      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Beleqet job escrow' }),
      );
    });

    it('strips PII fields from metadata before sending to Stripe', async () => {
      (stripe.paymentIntents.create as jest.Mock).mockResolvedValue(makeIntent());

      await service.createPaymentIntent({
        amount:   1000,
        currency: 'USD',
        userId:   'user-uuid-003',
        metadata: {
          email:  'john@example.com',     // must be stripped
          phone:  '+251911111111',         // must be stripped
          jobId:  'job-uuid-abc',          // must be kept
        } as any,
      });

      const calledWith = (stripe.paymentIntents.create as jest.Mock).mock.calls[0][0];
      expect(calledWith.metadata).not.toHaveProperty('email');
      expect(calledWith.metadata).not.toHaveProperty('phone');
      expect(calledWith.metadata).toHaveProperty('jobId', 'job-uuid-abc');
    });

    it('throws BadRequestException for an invalid currency code', async () => {
      await expect(
        service.createPaymentIntent({
          amount: 100, currency: 'XX', userId: 'user-uuid-004',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws UnprocessableEntityException on StripeCardError', async () => {
      const cardError = new (Stripe as any).errors.StripeCardError('card_declined');
      (stripe.paymentIntents.create as jest.Mock).mockRejectedValue(cardError);

      await expect(
        service.createPaymentIntent({ amount: 100, currency: 'USD', userId: 'u' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws BadRequestException on StripeInvalidRequestError', async () => {
      const invalidErr = new (Stripe as any).errors.StripeInvalidRequestError('bad param');
      (stripe.paymentIntents.create as jest.Mock).mockRejectedValue(invalidErr);

      await expect(
        service.createPaymentIntent({ amount: 100, currency: 'USD', userId: 'u' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerErrorException on generic StripeError', async () => {
      const stripeErr = new (Stripe as any).errors.StripeError('rate_limit');
      (stripe.paymentIntents.create as jest.Mock).mockRejectedValue(stripeErr);

      await expect(
        service.createPaymentIntent({ amount: 100, currency: 'USD', userId: 'u' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('throws InternalServerErrorException on an unexpected error', async () => {
      (stripe.paymentIntents.create as jest.Mock).mockRejectedValue(
        new Error('network timeout'),
      );

      await expect(
        service.createPaymentIntent({ amount: 100, currency: 'USD', userId: 'u' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('works for ETB currency (African market support)', async () => {
      (stripe.paymentIntents.create as jest.Mock).mockResolvedValue(
        makeIntent({ currency: 'etb', amount: 5000 }),
      );

      const result = await service.createPaymentIntent({
        amount: 5000, currency: 'ETB', userId: 'user-uuid-eth',
      });

      expect(result.currency).toBe('ETB');
    });

    it('sends currency as lowercase to Stripe SDK', async () => {
      (stripe.paymentIntents.create as jest.Mock).mockResolvedValue(makeIntent());

      await service.createPaymentIntent({
        amount: 100, currency: 'EUR', userId: 'u',
      });

      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'eur' }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // confirmPayment
  // ──────────────────────────────────────────────────────────────────────────
  describe('confirmPayment', () => {
    it('confirms a PaymentIntent and returns the result', async () => {
      (stripe.paymentIntents.confirm as jest.Mock).mockResolvedValue(
        makeIntent({ status: 'succeeded' }),
      );

      const result = await service.confirmPayment('pi_test_001', 'pm_card_visa');

      expect(result.id).toBe('pi_test_001');
      expect(result.status).toBe('succeeded');
    });

    it('updates payment status to SUCCEEDED in the DB', async () => {
      (stripe.paymentIntents.confirm as jest.Mock).mockResolvedValue(
        makeIntent({ status: 'succeeded' }),
      );

      await service.confirmPayment('pi_test_001', 'pm_card_visa');

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCEEDED' }),
        }),
      );
    });

    it('updates payment status to CANCELLED when status is canceled', async () => {
      (stripe.paymentIntents.confirm as jest.Mock).mockResolvedValue(
        makeIntent({ status: 'canceled' }),
      );

      await service.confirmPayment('pi_test_001', 'pm_card_visa');

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('throws UnprocessableEntityException on StripeCardError during confirm', async () => {
      (stripe.paymentIntents.confirm as jest.Mock).mockRejectedValue(
        new (Stripe as any).errors.StripeCardError('Your card was declined.'),
      );

      await expect(
        service.confirmPayment('pi_fail', 'pm_bad'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws InternalServerErrorException on network error during confirm', async () => {
      (stripe.paymentIntents.confirm as jest.Mock).mockRejectedValue(
        new Error('ECONNRESET'),
      );

      await expect(
        service.confirmPayment('pi_test_001', 'pm_card_visa'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // refund
  // ──────────────────────────────────────────────────────────────────────────
  describe('refund', () => {
    it('issues a full refund and returns the refund result', async () => {
      (stripe.refunds.create as jest.Mock).mockResolvedValue(makeRefund());

      const result = await service.refund({
        paymentIntentId: 'pi_test_001',
      });

      expect(result.id).toBe('re_test_001');
      expect(result.status).toBe('succeeded');
      expect(result.paymentIntentId).toBe('pi_test_001');
    });

    it('issues a partial refund with the specified amount', async () => {
      (stripe.refunds.create as jest.Mock).mockResolvedValue(
        makeRefund({ amount: 2000 }),
      );

      const result = await service.refund({
        paymentIntentId: 'pi_test_001',
        amount:          2000,
      });

      expect(result.amount).toBe(2000);
    });

    it('updates DB status to REFUNDED for a full refund', async () => {
      (stripe.refunds.create as jest.Mock).mockResolvedValue(makeRefund());

      await service.refund({ paymentIntentId: 'pi_test_001' });

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REFUNDED' }),
        }),
      );
    });

    it('updates DB status to PARTIALLY_REFUNDED for a partial refund', async () => {
      (stripe.refunds.create as jest.Mock).mockResolvedValue(
        makeRefund({ amount: 1000 }),
      );

      await service.refund({ paymentIntentId: 'pi_test_001', amount: 1000 });

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PARTIALLY_REFUNDED' }),
        }),
      );
    });

    it('passes payment_intent id to the Stripe refunds.create call', async () => {
      (stripe.refunds.create as jest.Mock).mockResolvedValue(makeRefund());

      await service.refund({ paymentIntentId: 'pi_abc_123' });

      expect(stripe.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({ payment_intent: 'pi_abc_123' }),
      );
    });

    it('throws InternalServerErrorException on Stripe API error during refund', async () => {
      (stripe.refunds.create as jest.Mock).mockRejectedValue(
        new (Stripe as any).errors.StripeError('server_error'),
      );

      await expect(
        service.refund({ paymentIntentId: 'pi_test_001' }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleWebhook
  // ──────────────────────────────────────────────────────────────────────────
  describe('handleWebhook', () => {
    it('processes a payment_intent.succeeded event', async () => {
      const event = makeWebhookEvent('payment_intent.succeeded');
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(event);

      const result = await service.handleWebhook(
        Buffer.from('{}'),
        't=1,v1=sig',
      );

      expect(result.type).toBe('payment_intent.succeeded');
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCEEDED' }),
        }),
      );
    });

    it('processes a payment_intent.payment_failed event', async () => {
      const event = makeWebhookEvent('payment_intent.payment_failed');
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(event);

      await service.handleWebhook(Buffer.from('{}'), 't=1,v1=sig');

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('processes a payment_intent.processing event', async () => {
      const event = makeWebhookEvent('payment_intent.processing');
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(event);

      await service.handleWebhook(Buffer.from('{}'), 't=1,v1=sig');

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PROCESSING' }),
        }),
      );
    });

    it('processes a charge.refunded event', async () => {
      const event = makeWebhookEvent('charge.refunded', {
        payment_intent: 'pi_test_refund',
      });
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(event);

      await service.handleWebhook(Buffer.from('{}'), 't=1,v1=sig');

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ providerPaymentId: 'pi_test_refund' }),
          data:  expect.objectContaining({ status: 'REFUNDED' }),
        }),
      );
    });

    it('gracefully ignores unhandled event types without throwing', async () => {
      const event = makeWebhookEvent('customer.created');
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(event);

      const result = await service.handleWebhook(Buffer.from('{}'), 't=1,v1=sig');
      expect(result.type).toBe('customer.created');
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('throws UnprocessableEntityException when signature verification fails', async () => {
      (stripe.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        service.handleWebhook(Buffer.from('{}'), 'bad_signature'),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('returns the event id and livemode flag in the response', async () => {
      const event = makeWebhookEvent('payment_intent.succeeded');
      (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue(event);

      const result = await service.handleWebhook(Buffer.from('{}'), 't=1,v1=sig');

      expect(result.id).toMatch(/^evt_/);
      expect(result.livemode).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // listSupportedCurrencies
  // ──────────────────────────────────────────────────────────────────────────
  describe('listSupportedCurrencies', () => {
    it('returns a non-empty array of currencies', () => {
      const currencies = service.listSupportedCurrencies();
      expect(Array.isArray(currencies)).toBe(true);
      expect(currencies.length).toBeGreaterThan(0);
    });

    it('includes ETB as a supported currency', () => {
      const currencies = service.listSupportedCurrencies();
      const etb = currencies.find((c) => c.code === 'ETB');
      expect(etb).toBeDefined();
    });

    it('includes USD, EUR, GBP as standard currencies', () => {
      const currencies = service.listSupportedCurrencies();
      const codes = currencies.map((c) => c.code);
      expect(codes).toContain('USD');
      expect(codes).toContain('EUR');
      expect(codes).toContain('GBP');
    });

    it('each currency entry has code, minimumAmount, and zeroDecimal fields', () => {
      const currencies = service.listSupportedCurrencies();
      for (const currency of currencies) {
        expect(currency).toHaveProperty('code');
        expect(currency).toHaveProperty('minimumAmount');
        expect(currency).toHaveProperty('zeroDecimal');
      }
    });

    it('JPY is marked as a zero-decimal currency', () => {
      const currencies = service.listSupportedCurrencies();
      const jpy = currencies.find((c) => c.code === 'JPY');
      expect(jpy?.zeroDecimal).toBe(true);
    });
  });
});
