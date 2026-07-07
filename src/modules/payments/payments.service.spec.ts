/**
 * @file payments.service.spec.ts
 * @description
 * Unit tests for StripeService and PaypalService.
 *
 * Strategy:
 *  - The Stripe SDK and paypal-rest-sdk are fully mocked — no real API calls.
 *  - PrismaService is mocked with jest.fn() stubs.
 *  - ConfigService returns fixture values via get/getOrThrow mocks.
 *  - Each test is isolated; no shared state between describes.
 *
 * Coverage:
 *  StripeService:
 *   ✓ createPaymentIntent — success path
 *   ✓ createPaymentIntent — invalid currency (bad format)
 *   ✓ createPaymentIntent — Stripe card error → UnprocessableEntityException
 *   ✓ createPaymentIntent — Stripe API error → InternalServerErrorException
 *   ✓ confirmPayment      — success path
 *   ✓ refund              — full refund success
 *   ✓ refund              — partial refund success
 *   ✓ handleWebhook       — valid signature → returns event
 *   ✓ handleWebhook       — invalid signature → UnprocessableEntityException
 *   ✓ listSupportedCurrencies — returns array
 *
 *  PaypalService:
 *   ✓ createOrder         — success path (one-time)
 *   ✓ createOrder         — delegates to createSubscription when planId provided
 *   ✓ captureOrder        — success path
 *   ✓ captureOrder        — missing payerId → BadRequestException
 *   ✓ createSubscription  — success path
 *   ✓ createSubscription  — missing planId → BadRequestException
 *   ✓ handleWebhook       — PAYMENT.CAPTURE.COMPLETED updates DB
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import Stripe from 'stripe';

import { StripeService }  from './stripe.service';
import { PaypalService }  from './paypal.service';
import { PrismaService }  from '../../prisma/prisma.service';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Stripe SDK
// ─────────────────────────────────────────────────────────────────────────────

const mockStripePaymentIntent = {
  id:            'pi_test_123',
  client_secret: 'pi_test_123_secret_abc',
  status:        'requires_payment_method' as Stripe.PaymentIntent.Status,
  amount:        1500,
  currency:      'usd',
  created:       Math.floor(Date.now() / 1000),
};

const mockStripeRefund = {
  id:               're_test_456',
  status:           'succeeded',
  amount:           1500,
  currency:         'usd',
  payment_intent:   'pi_test_123',
  created:          Math.floor(Date.now() / 1000),
};

const mockStripeEvent: Partial<Stripe.Event> = {
  id:       'evt_test_789',
  type:     'payment_intent.succeeded',
  created:  Math.floor(Date.now() / 1000),
  livemode: false,
  data:     { object: mockStripePaymentIntent as unknown as Stripe.PaymentIntent },
};

jest.mock('stripe', () => {
  const mockPaymentIntents = {
    create:  jest.fn(),
    confirm: jest.fn(),
  };
  const mockRefunds = {
    create: jest.fn(),
  };
  const mockWebhooks = {
    constructEvent: jest.fn(),
  };

  const MockStripe = jest.fn().mockImplementation(() => ({
    paymentIntents: mockPaymentIntents,
    refunds:        mockRefunds,
    webhooks:       mockWebhooks,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (MockStripe as any).errors = {
    StripeCardError:           class StripeCardError extends Error { constructor(msg: string) { super(msg); this.name = 'StripeCardError'; } },
    StripeInvalidRequestError: class StripeInvalidRequestError extends Error { constructor(msg: string) { super(msg); this.name = 'StripeInvalidRequestError'; } },
    StripeError:               class StripeError extends Error { constructor(msg: string) { super(msg); this.name = 'StripeError'; } },
  };

  return { __esModule: true, default: MockStripe };
});

// ─────────────────────────────────────────────────────────────────────────────
// Mock paypal-rest-sdk
// ─────────────────────────────────────────────────────────────────────────────

const mockPaypalPayment = {
  id:    'PAY-test-abc123',
  state: 'created',
  links: [
    { rel: 'approval_url', href: 'https://sandbox.paypal.com/cgi-bin/webscr?token=test' },
  ],
};

const mockPaypalExecuted = {
  state: 'approved',
  transactions: [
    { related_resources: [{ sale: { id: 'SALE-test-xyz' } }] },
  ],
};

const mockBillingAgreement = {
  id:    'I-TESTSUBSCRIPTION',
  state: 'Pending',
  links: [
    { rel: 'approval_url', href: 'https://sandbox.paypal.com/agreements/approve?token=test' },
  ],
};

jest.mock('paypal-rest-sdk', () => ({
  configure: jest.fn(),
  payment: {
    create:  jest.fn(),
    execute: jest.fn(),
  },
  billingAgreement: {
    create: jest.fn(),
  },
  notification: {
    webhookEvent: {
      verify: jest.fn(),
    },
  },
}));

import * as paypal from 'paypal-rest-sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Shared mock factories
// ─────────────────────────────────────────────────────────────────────────────

function buildMockPrisma() {
  return {
    payment: {
      upsert:     jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaService;
}

function buildMockConfig(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    STRIPE_SECRET_KEY:       'sk_test_mock_key',
    STRIPE_WEBHOOK_SECRET:   'whsec_mock_secret',
    PAYPAL_CLIENT_ID:        'paypal_client_id_mock',
    PAYPAL_CLIENT_SECRET:    'paypal_client_secret_mock',
    PAYPAL_MODE:             'sandbox',
    PAYPAL_WEBHOOK_ID:       '',
    PAYPAL_RETURN_URL:       'https://beleqet.com/payment/success',
    PAYPAL_CANCEL_URL:       'https://beleqet.com/payment/cancel',
    ...overrides,
  };
  return {
    getOrThrow: jest.fn((key: string) => {
      if (key in defaults) return defaults[key];
      throw new Error(`Missing config: ${key}`);
    }),
    get: jest.fn((key: string, fallback?: string) => defaults[key] ?? fallback ?? ''),
  } as unknown as ConfigService;
}

// ─────────────────────────────────────────────────────────────────────────────
// StripeService tests
// ─────────────────────────────────────────────────────────────────────────────

describe('StripeService', () => {
  let service: StripeService;
  let prisma: PrismaService;
  let stripeInstance: Stripe;

  beforeEach(async () => {
    prisma = buildMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: ConfigService,  useValue: buildMockConfig() },
        { provide: PrismaService,  useValue: prisma },
      ],
    }).compile();

    service       = module.get<StripeService>(StripeService);
    stripeInstance = (service as unknown as { stripe: Stripe }).stripe;
  });

  afterEach(() => jest.clearAllMocks());

  // ── createPaymentIntent ────────────────────────────────────────────────────

  describe('createPaymentIntent', () => {
    it('creates a payment intent and returns client-safe result', async () => {
      (stripeInstance.paymentIntents.create as jest.Mock).mockResolvedValue(
        mockStripePaymentIntent,
      );

      const result = await service.createPaymentIntent({
        amount:   1500,
        currency: 'USD',
        userId:   'user-uuid-001',
      });

      expect(result.id).toBe('pi_test_123');
      expect(result.clientSecret).toBe('pi_test_123_secret_abc');
      expect(result.amount).toBe(1500);
      expect(result.currency).toBe('USD');
      expect(stripeInstance.paymentIntents.create).toHaveBeenCalledTimes(1);
      expect(prisma.payment.upsert).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException for non-alphabetic currency code', async () => {
      await expect(
        service.createPaymentIntent({
          amount:   100,
          currency: '12X',  // invalid: contains digits
          userId:   'user-uuid-001',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(stripeInstance.paymentIntents.create).not.toHaveBeenCalled();
    });

    it('throws UnprocessableEntityException on Stripe card error', async () => {
      const cardErr = new (Stripe as unknown as {
        errors: { StripeCardError: new (m: string) => Error };
      }).errors.StripeCardError('Your card was declined.');
      (stripeInstance.paymentIntents.create as jest.Mock).mockRejectedValue(cardErr);

      await expect(
        service.createPaymentIntent({ amount: 1500, currency: 'USD', userId: 'u1' }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('throws InternalServerErrorException on generic Stripe error', async () => {
      const stripeErr = new (Stripe as unknown as {
        errors: { StripeError: new (m: string) => Error };
      }).errors.StripeError('Stripe internal failure');
      (stripeInstance.paymentIntents.create as jest.Mock).mockRejectedValue(stripeErr);

      await expect(
        service.createPaymentIntent({ amount: 1500, currency: 'USD', userId: 'u1' }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('strips PII keys from metadata before sending to Stripe', async () => {
      (stripeInstance.paymentIntents.create as jest.Mock).mockResolvedValue(
        mockStripePaymentIntent,
      );

      await service.createPaymentIntent({
        amount:   500,
        currency: 'EUR',
        userId:   'user-uuid-002',
        metadata: {
          email:  'user@example.com', // PII — must be stripped
          jobId:  'job-abc123',       // safe
          planTier: 'premium',        // safe
        },
      });

      const callArgs = (stripeInstance.paymentIntents.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.metadata.email).toBeUndefined();
      expect(callArgs.metadata.jobId).toBe('job-abc123');
      expect(callArgs.metadata.planTier).toBe('premium');
    });
  });

  // ── confirmPayment ────────────────────────────────────────────────────────

  describe('confirmPayment', () => {
    it('confirms a payment intent and updates DB', async () => {
      (stripeInstance.paymentIntents.confirm as jest.Mock).mockResolvedValue({
        ...mockStripePaymentIntent,
        status: 'succeeded' as Stripe.PaymentIntent.Status,
      });

      const result = await service.confirmPayment('pi_test_123', 'pm_test_card');

      expect(result.status).toBe('succeeded');
      expect(stripeInstance.paymentIntents.confirm).toHaveBeenCalledWith(
        'pi_test_123',
        { payment_method: 'pm_test_card' },
      );
      expect(prisma.payment.updateMany).toHaveBeenCalledTimes(1);
    });
  });

  // ── refund ─────────────────────────────────────────────────────────────────

  describe('refund', () => {
    it('issues a full refund', async () => {
      (stripeInstance.refunds.create as jest.Mock).mockResolvedValue(mockStripeRefund);

      const result = await service.refund({ paymentIntentId: 'pi_test_123' });

      expect(result.id).toBe('re_test_456');
      expect(result.status).toBe('succeeded');
      expect((stripeInstance.refunds.create as jest.Mock).mock.calls[0][0]).toEqual(
        expect.objectContaining({ payment_intent: 'pi_test_123' }),
      );
    });

    it('issues a partial refund with amount', async () => {
      (stripeInstance.refunds.create as jest.Mock).mockResolvedValue({
        ...mockStripeRefund,
        amount: 500,
      });

      const result = await service.refund({
        paymentIntentId: 'pi_test_123',
        amount: 500,
      });

      expect(result.amount).toBe(500);
      // Partial refund → PARTIALLY_REFUNDED in DB
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'PARTIALLY_REFUNDED' }),
        }),
      );
    });
  });

  // ── handleWebhook ─────────────────────────────────────────────────────────

  describe('handleWebhook', () => {
    it('returns parsed event on valid signature', async () => {
      (stripeInstance.webhooks.constructEvent as jest.Mock).mockReturnValue(
        mockStripeEvent,
      );

      const result = await service.handleWebhook(
        Buffer.from('raw-body'),
        't=123,v1=abc',
      );

      expect(result.id).toBe('evt_test_789');
      expect(result.type).toBe('payment_intent.succeeded');
    });

    it('throws UnprocessableEntityException on invalid signature', async () => {
      (stripeInstance.webhooks.constructEvent as jest.Mock).mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature for payload');
      });

      await expect(
        service.handleWebhook(Buffer.from('bad'), 'bad-sig'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });
  });

  // ── listSupportedCurrencies ───────────────────────────────────────────────

  describe('listSupportedCurrencies', () => {
    it('returns an array with USD and ETB entries', () => {
      const currencies = service.listSupportedCurrencies();

      expect(Array.isArray(currencies)).toBe(true);
      expect(currencies.length).toBeGreaterThan(0);

      const usd = currencies.find((c) => c.code === 'USD');
      const etb = currencies.find((c) => c.code === 'ETB');

      expect(usd).toBeDefined();
      expect(etb).toBeDefined();
      expect(usd!.minimumAmount).toBeGreaterThan(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PaypalService tests
// ─────────────────────────────────────────────────────────────────────────────

describe('PaypalService', () => {
  let service: PaypalService;
  let prisma: PrismaService;

  beforeEach(async () => {
    prisma = buildMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaypalService,
        { provide: ConfigService,  useValue: buildMockConfig() },
        { provide: PrismaService,  useValue: prisma },
      ],
    }).compile();

    service = module.get<PaypalService>(PaypalService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── createOrder ───────────────────────────────────────────────────────────

  describe('createOrder', () => {
    it('creates a PayPal order and returns approvalUrl', async () => {
      (paypal.payment.create as jest.Mock).mockImplementation(
        (_data: unknown, cb: (err: null, p: typeof mockPaypalPayment) => void) =>
          cb(null, mockPaypalPayment),
      );

      const result = await service.createOrder({
        amount:   25.0,
        currency: 'USD',
        userId:   'user-uuid-001',
      });

      expect(result.id).toBe('PAY-test-abc123');
      expect(result.approvalUrl).toContain('sandbox.paypal.com');
      expect(result.currency).toBe('USD');
      expect(prisma.payment.upsert).toHaveBeenCalledTimes(1);
    });

    it('rejects with InternalServerErrorException on PayPal API error', async () => {
      (paypal.payment.create as jest.Mock).mockImplementation(
        (_data: unknown, cb: (err: { message: string }, p: null) => void) =>
          cb({ message: 'PayPal API error' }, null),
      );

      await expect(
        service.createOrder({ amount: 25, currency: 'USD', userId: 'u1' }),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('delegates to createSubscription when subscriptionPlanId is provided', async () => {
      (paypal.billingAgreement.create as jest.Mock).mockImplementation(
        (_data: unknown, cb: (err: null, b: typeof mockBillingAgreement) => void) =>
          cb(null, mockBillingAgreement),
      );

      const result = await service.createOrder({
        amount:             10,
        currency:           'USD',
        userId:             'user-uuid-001',
        subscriptionPlanId: 'P-PLAN123',
      });

      expect(result.id).toBe('I-TESTSUBSCRIPTION');
      expect(paypal.billingAgreement.create).toHaveBeenCalledTimes(1);
      expect(paypal.payment.create).not.toHaveBeenCalled();
    });
  });

  // ── captureOrder ──────────────────────────────────────────────────────────

  describe('captureOrder', () => {
    it('captures an approved PayPal order', async () => {
      (paypal.payment.execute as jest.Mock).mockImplementation(
        (_id: string, _data: unknown, cb: (err: null, p: typeof mockPaypalExecuted) => void) =>
          cb(null, mockPaypalExecuted),
      );

      const result = await service.captureOrder(
        { orderId: 'PAY-test-abc123' },
        'PAYER-ID-XYZ',
      );

      expect(result.orderId).toBe('PAY-test-abc123');
      expect(result.status).toBe('approved');
      expect(result.captureId).toBe('SALE-test-xyz');
      expect(prisma.payment.updateMany).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when payerId is empty', async () => {
      await expect(
        service.captureOrder({ orderId: 'PAY-test-abc123' }, ''),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(paypal.payment.execute).not.toHaveBeenCalled();
    });
  });

  // ── createSubscription ────────────────────────────────────────────────────

  describe('createSubscription', () => {
    it('creates a recurring billing agreement', async () => {
      (paypal.billingAgreement.create as jest.Mock).mockImplementation(
        (_data: unknown, cb: (err: null, b: typeof mockBillingAgreement) => void) =>
          cb(null, mockBillingAgreement),
      );

      const result = await service.createSubscription({
        amount:             9.99,
        currency:           'USD',
        userId:             'user-uuid-001',
        subscriptionPlanId: 'P-PLAN123',
      });

      expect(result.id).toBe('I-TESTSUBSCRIPTION');
      expect(result.planId).toBe('P-PLAN123');
      expect(result.approvalUrl).toContain('sandbox.paypal.com');
    });

    it('throws BadRequestException when subscriptionPlanId is missing', async () => {
      await expect(
        service.createSubscription({
          amount:   9.99,
          currency: 'USD',
          userId:   'user-uuid-001',
          // subscriptionPlanId intentionally omitted
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(paypal.billingAgreement.create).not.toHaveBeenCalled();
    });
  });

  // ── handleWebhook ─────────────────────────────────────────────────────────

  describe('handleWebhook', () => {
    it('processes PAYMENT.CAPTURE.COMPLETED and updates DB to SUCCEEDED', async () => {
      const event = {
        id:            'WH-test-001',
        event_type:    'PAYMENT.CAPTURE.COMPLETED',
        resource_type: 'capture',
        summary:       'Payment completed for ORDER-123',
        resource:      { id: 'PAY-test-abc123' },
        create_time:   new Date().toISOString(),
      };

      await service.handleWebhook(event, {});

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { providerPaymentId: 'PAY-test-abc123' },
          data:  expect.objectContaining({ status: 'SUCCEEDED' }),
        }),
      );
    });

    it('processes BILLING.SUBSCRIPTION.CANCELLED and updates DB to CANCELLED', async () => {
      const event = {
        id:            'WH-test-002',
        event_type:    'BILLING.SUBSCRIPTION.CANCELLED',
        resource_type: 'subscription',
        summary:       'Subscription cancelled',
        resource:      { id: 'I-TESTSUBSCRIPTION' },
        create_time:   new Date().toISOString(),
      };

      await service.handleWebhook(event, {});

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('does not throw on unhandled event types', async () => {
      const event = {
        id:            'WH-test-003',
        event_type:    'SOME.UNKNOWN.EVENT',
        resource_type: 'unknown',
        summary:       '',
        resource:      {},
        create_time:   new Date().toISOString(),
      };

      await expect(service.handleWebhook(event, {})).resolves.not.toThrow();
    });
  });
});
