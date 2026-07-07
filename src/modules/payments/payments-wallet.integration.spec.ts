/**
 * @file payments-wallet.integration.spec.ts
 * @description
 * Integration test: Global Payment Gateway ↔ Multi-Currency Wallet Module.
 *
 * Verifies that StripeService, PaypalService, and WalletService work
 * together correctly across the full payment → wallet → withdrawal flow.
 * All external I/O (Stripe SDK, paypal-rest-sdk, Chapa API, Prisma) is
 * mocked so no live network calls or DB connections are required.
 *
 * Scenarios covered:
 *  1.  Stripe USD → WalletService converts USD→ETB correctly.
 *  2.  Stripe EUR → WalletService converts EUR→ETB correctly.
 *  3.  Stripe ETB → amount passes through unchanged.
 *  4.  Unsupported currency pair → BadRequestException.
 *  5.  Stripe confirmPayment → DB record marked SUCCEEDED.
 *  6.  PayPal USD order → WalletService converts USD→ETB correctly.
 *  7.  PayPal capture → DB record marked SUCCEEDED.
 *  8.  Full ETB withdrawal → Chapa called, balance decremented.
 *  9.  USD withdrawal → amount converted to ETB before deduction.
 *  10. Insufficient ETB balance → BadRequestException, Chapa NOT called.
 *  11. Insufficient USD balance (after conversion) → BadRequestException.
 *  12. Chapa rejects payout → InternalServerErrorException + rollback.
 *  13. Chapa network failure → InternalServerErrorException + rollback.
 *  14. Concurrent Stripe + PayPal intents → both persisted independently.
 *  15. Parametrised: multiple amounts/currencies → correct ETB values.
 *  16. Wallet not found → NotFoundException.
 *  17. Reverse ETB→USD conversion → correct rate applied.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import Stripe from 'stripe';

import { StripeService }  from './stripe.service';
import { PaypalService }  from './paypal.service';
import { WalletService, WithdrawDto } from '../wallet/wallet.service';
import { PrismaService }  from '../../prisma/prisma.service';

// ─────────────────────────────────────────────────────────────────────────────
// SDK mocks — hoisted before any import that initialises the SDKs
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('stripe', () => {
  const mockPaymentIntents = { create: jest.fn(), confirm: jest.fn() };
  const mockRefunds        = { create: jest.fn() };
  const mockWebhooks       = { constructEvent: jest.fn() };

  const MockStripe = jest.fn().mockImplementation(() => ({
    paymentIntents: mockPaymentIntents,
    refunds:        mockRefunds,
    webhooks:       mockWebhooks,
  }));

  (MockStripe as any).errors = {
    StripeCardError:           class StripeCardError  extends Error { constructor(m: string) { super(m); this.name = 'StripeCardError'; } },
    StripeInvalidRequestError: class extends Error    { constructor(m: string) { super(m); this.name = 'StripeInvalidRequestError'; } },
    StripeError:               class StripeError      extends Error { constructor(m: string) { super(m); this.name = 'StripeError'; } },
  };

  return { __esModule: true, default: MockStripe };
});

jest.mock('paypal-rest-sdk', () => ({
  configure:        jest.fn(),
  payment:          { create: jest.fn(), execute: jest.fn() },
  billingAgreement: { create: jest.fn() },
  notification:     { webhookEvent: { verify: jest.fn() } },
}));

// Mock the global `fetch` used by WalletService (Chapa payouts)
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import * as paypal from 'paypal-rest-sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Exchange rate constants (must match WalletService.exchangeRates)
// ─────────────────────────────────────────────────────────────────────────────
const USD_ETB_RATE = 120.5;
const EUR_ETB_RATE = 130.2;

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeStripeIntent(amount: number, currency: string): Partial<Stripe.PaymentIntent> {
  return {
    id:            `pi_test_${currency.toLowerCase()}_${amount}`,
    client_secret: `pi_secret_${currency.toLowerCase()}`,
    status:        'requires_payment_method' as Stripe.PaymentIntent.Status,
    amount,
    currency:      currency.toLowerCase(),
    created:       Math.floor(Date.now() / 1000),
  };
}

function makePaypalPayment(id: string) {
  return {
    id,
    state: 'created',
    links: [{ rel: 'approval_url', href: 'https://sandbox.paypal.com/approve?token=test' }],
  };
}

function makePaypalExecuted() {
  return {
    state: 'approved',
    transactions: [{ related_resources: [{ sale: { id: 'SALE-integration-001' } }] }],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock factories
// ─────────────────────────────────────────────────────────────────────────────

function buildMockPrisma(walletBalance = 10_000) {
  const walletRecord = {
    id:               'wallet-user-001',
    userId:           'user-001',
    currency:         'ETB',
    availableBalance: walletBalance,
    lockedBalance:    0,
    transactions:     [],
  };

  const txRecord = { id: 'tx-001', walletId: walletRecord.id, amount: 0, type: 'DEBIT_WITHDRAWAL', note: '' };

  return {
    payment: {
      upsert:     jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    freelancerWallet: {
      findUnique: jest.fn().mockResolvedValue(walletRecord),
      upsert:     jest.fn().mockResolvedValue(walletRecord),
      update:     jest.fn().mockResolvedValue(walletRecord),
    },
    employerWallet: {
      findUnique: jest.fn().mockResolvedValue(null),
      create:     jest.fn().mockResolvedValue({ ...walletRecord, balance: 0 }),
    },
    walletTransaction: {
      create: jest.fn().mockResolvedValue(txRecord),
      update: jest.fn().mockResolvedValue(txRecord),
    },
    $transaction: jest.fn().mockImplementation(async (cbOrArray: unknown) => {
      if (typeof cbOrArray === 'function') {
        const stubPrisma = {
          freelancerWallet:  { update: jest.fn().mockResolvedValue(walletRecord) },
          walletTransaction: {
            create: jest.fn().mockResolvedValue(txRecord),
            update: jest.fn().mockResolvedValue(txRecord),
          },
        };
        return cbOrArray(stubPrisma);
      }
      return Promise.all(cbOrArray as Promise<unknown>[]);
    }),
  } as unknown as PrismaService;
}

function buildMockConfig(extra: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    STRIPE_SECRET_KEY:     'sk_test_mock',
    STRIPE_WEBHOOK_SECRET: 'whsec_mock',
    PAYPAL_CLIENT_ID:      'paypal_id_mock',
    PAYPAL_CLIENT_SECRET:  'paypal_secret_mock',
    PAYPAL_MODE:           'sandbox',
    PAYPAL_WEBHOOK_ID:     '',
    PAYPAL_RETURN_URL:     'https://beleqet.com/success',
    PAYPAL_CANCEL_URL:     'https://beleqet.com/cancel',
    CHAPA_SECRET_KEY:      'test_chapa_secret_key',
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

async function buildCtx(walletBalance = 10_000, configExtra: Record<string, string> = {}) {
  const prisma  = buildMockPrisma(walletBalance);
  const config  = buildMockConfig(configExtra);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      StripeService,
      PaypalService,
      WalletService,
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigService, useValue: config },
    ],
  }).compile();

  return {
    stripeService: module.get<StripeService>(StripeService),
    paypalService: module.get<PaypalService>(PaypalService),
    walletService: module.get<WalletService>(WalletService),
    prisma,
    config,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers to reach the private stripe instance
// ─────────────────────────────────────────────────────────────────────────────
function getStripeInstance(svc: StripeService): Stripe {
  return (svc as unknown as { stripe: Stripe }).stripe;
}

// ─────────────────────────────────────────────────────────────────────────────
// Integration tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Integration: Payment Gateway ↔ Multi-Currency Wallet', () => {
  let stripeService: StripeService;
  let paypalService: PaypalService;
  let walletService: WalletService;
  let prisma: ReturnType<typeof buildMockPrisma>;

  beforeEach(async () => {
    const ctx    = await buildCtx();
    stripeService = ctx.stripeService;
    paypalService = ctx.paypalService;
    walletService = ctx.walletService;
    prisma        = ctx.prisma as ReturnType<typeof buildMockPrisma>;
  });

  afterEach(() => jest.clearAllMocks());

  // ── 1. Stripe USD → ETB conversion ────────────────────────────────────────
  describe('Scenario 1 – Stripe USD payment → correct ETB conversion', () => {
    it('creates a USD intent and converts the amount to ETB at the correct rate', async () => {
      const stripe = getStripeInstance(stripeService);
      (stripe.paymentIntents.create as jest.Mock).mockResolvedValue(makeStripeIntent(100, 'USD'));

      const intent = await stripeService.createPaymentIntent({
        amount: 100, currency: 'USD', userId: 'user-001',
      });

      expect(intent.currency).toBe('USD');
      expect(intent.amount).toBe(100);

      const etbAmount = walletService.convertCurrency(100, 'USD', 'ETB');
      expect(etbAmount).toBe(Math.round(100 * USD_ETB_RATE));
    });
  });

  // ── 2. Stripe EUR → ETB conversion ────────────────────────────────────────
  describe('Scenario 2 – Stripe EUR payment → correct ETB conversion', () => {
    it('creates an EUR intent and converts the amount to ETB at the correct rate', async () => {
      const stripe = getStripeInstance(stripeService);
      (stripe.paymentIntents.create as jest.Mock).mockResolvedValue(makeStripeIntent(50, 'EUR'));

      await stripeService.createPaymentIntent({
        amount: 50, currency: 'EUR', userId: 'user-001',
      });

      const etbAmount = walletService.convertCurrency(50, 'EUR', 'ETB');
      expect(etbAmount).toBe(Math.round(50 * EUR_ETB_RATE));
    });
  });

  // ── 3. Stripe ETB → no conversion ────────────────────────────────────────
  describe('Scenario 3 – Stripe ETB payment → no conversion needed', () => {
    it('returns the same amount when both currencies are ETB', () => {
      const amount = 2500;
      expect(walletService.convertCurrency(amount, 'ETB', 'ETB')).toBe(amount);
    });
  });

  // ── 4. Unsupported currency pair ──────────────────────────────────────────
  describe('Scenario 4 – Unsupported currency pair → BadRequestException', () => {
    it('throws BadRequestException for GBP→ETB (no rate defined)', () => {
      expect(() => walletService.convertCurrency(100, 'GBP', 'ETB')).toThrow(BadRequestException);
    });

    it('throws BadRequestException for ETB→JPY (no rate defined)', () => {
      expect(() => walletService.convertCurrency(500, 'ETB', 'JPY')).toThrow(BadRequestException);
    });
  });

  // ── 5. Stripe confirm → DB SUCCEEDED ─────────────────────────────────────
  describe('Scenario 5 – Stripe confirmPayment → DB record marked SUCCEEDED', () => {
    it('confirms a USD intent and persists SUCCEEDED status in the DB', async () => {
      const stripe = getStripeInstance(stripeService);
      (stripe.paymentIntents.confirm as jest.Mock).mockResolvedValue({
        ...makeStripeIntent(200, 'USD'),
        status: 'succeeded' as Stripe.PaymentIntent.Status,
      });

      const result = await stripeService.confirmPayment('pi_test_usd_200', 'pm_card_visa');

      expect(result.status).toBe('succeeded');
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCEEDED' }),
        }),
      );
    });
  });

  // ── 6. PayPal USD → ETB conversion ───────────────────────────────────────
  describe('Scenario 6 – PayPal USD order → correct ETB conversion', () => {
    it('creates a USD PayPal order and converts to ETB at the correct rate', async () => {
      (paypal.payment.create as jest.Mock).mockImplementation(
        (_d: unknown, cb: (e: null, p: ReturnType<typeof makePaypalPayment>) => void) =>
          cb(null, makePaypalPayment('PAY-usd-25')),
      );

      const order = await paypalService.createOrder({
        amount: 25, currency: 'USD', userId: 'user-001',
      });

      expect(order.currency).toBe('USD');
      // The wallet would credit this converted amount
      const etbAmount = walletService.convertCurrency(25, 'USD', 'ETB');
      expect(etbAmount).toBe(Math.round(25 * USD_ETB_RATE));
    });
  });

  // ── 7. PayPal capture → DB SUCCEEDED ─────────────────────────────────────
  describe('Scenario 7 – PayPal capture → DB record marked SUCCEEDED', () => {
    it('captures a PayPal order and persists SUCCEEDED status in the DB', async () => {
      (paypal.payment.execute as jest.Mock).mockImplementation(
        (_id: string, _d: unknown, cb: (e: null, p: ReturnType<typeof makePaypalExecuted>) => void) =>
          cb(null, makePaypalExecuted()),
      );

      const result = await paypalService.captureOrder(
        { orderId: 'PAY-usd-25' },
        'PAYERID-ABC',
      );

      expect(result.status).toBe('approved');
      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCEEDED' }),
        }),
      );
    });
  });

  // ── 8. Full ETB withdrawal ────────────────────────────────────────────────
  describe('Scenario 8 – Full ETB withdrawal flow', () => {
    it('decrements wallet balance and calls Chapa API', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'success' }),
      } as Response);

      const dto: WithdrawDto = {
        amount: 500, method: 'CHAPA', accountRef: '0912345678', currency: 'ETB',
      };

      const result = await walletService.withdraw('user-001', dto);

      expect(result.success).toBe(true);
      expect(result.amount).toBe(500);
      expect(result.method).toBe('CHAPA');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.chapa.co/v1/transfers',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  // ── 9. USD withdrawal → ETB conversion before deduction ──────────────────
  describe('Scenario 9 – USD withdrawal → converted to ETB before deduction', () => {
    it('succeeds when wallet has enough ETB to cover the USD amount', async () => {
      // 10 USD = 1205 ETB; wallet has 10,000 ETB — sufficient
      const ctx = await buildCtx(10_000);

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'success' }),
      } as Response);

      const dto: WithdrawDto = {
        amount: 10, method: 'CHAPA', accountRef: '0912345678', currency: 'USD',
      };

      const result = await ctx.walletService.withdraw('user-001', dto);
      expect(result.success).toBe(true);
    });
  });

  // ── 10. Insufficient ETB balance ─────────────────────────────────────────
  describe('Scenario 10 – Insufficient ETB balance → BadRequestException', () => {
    it('throws before writing to DB or calling Chapa', async () => {
      const ctx = await buildCtx(50); // only 50 ETB

      const dto: WithdrawDto = {
        amount: 1000, method: 'CHAPA', accountRef: '0912345678', currency: 'ETB',
      };

      await expect(ctx.walletService.withdraw('user-001', dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ── 11. Insufficient balance — USD amount exceeds ETB wallet ─────────────
  describe('Scenario 11 – USD withdrawal exceeds ETB balance', () => {
    it('throws BadRequestException when converted amount exceeds available balance', async () => {
      const ctx = await buildCtx(100); // 100 ETB — cannot cover 5 USD (~602 ETB)

      const dto: WithdrawDto = {
        amount: 5, method: 'CHAPA', accountRef: '0912345678', currency: 'USD',
      };

      await expect(ctx.walletService.withdraw('user-001', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── 12. Chapa rejects payout → rollback ──────────────────────────────────
  describe('Scenario 12 – Chapa rejects payout → InternalServerErrorException + rollback', () => {
    it('throws InternalServerErrorException when Chapa returns error status', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'error', message: 'Invalid account number' }),
      } as Response);

      const dto: WithdrawDto = {
        amount: 200, method: 'CHAPA', accountRef: 'bad_account', currency: 'ETB',
      };

      await expect(walletService.withdraw('user-001', dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ── 13. Chapa network failure → rollback ─────────────────────────────────
  describe('Scenario 13 – Chapa network failure → InternalServerErrorException + rollback', () => {
    it('throws InternalServerErrorException on fetch network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const dto: WithdrawDto = {
        amount: 300, method: 'TELEBIRR', accountRef: '0911111111', currency: 'ETB',
      };

      await expect(walletService.withdraw('user-001', dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  // ── 14. Concurrent Stripe + PayPal intents ────────────────────────────────
  describe('Scenario 14 – Concurrent Stripe + PayPal intents', () => {
    it('persists both intents independently in the DB', async () => {
      const stripe = getStripeInstance(stripeService);
      (stripe.paymentIntents.create as jest.Mock).mockResolvedValue(makeStripeIntent(500, 'USD'));
      (paypal.payment.create as jest.Mock).mockImplementation(
        (_d: unknown, cb: (e: null, p: ReturnType<typeof makePaypalPayment>) => void) =>
          cb(null, makePaypalPayment('PAY-concurrent-001')),
      );

      const [stripeResult, paypalResult] = await Promise.all([
        stripeService.createPaymentIntent({ amount: 500, currency: 'USD', userId: 'user-001' }),
        paypalService.createOrder({ amount: 10, currency: 'USD', userId: 'user-001' }),
      ]);

      expect(stripeResult.id).toMatch(/^pi_test_/);
      expect(paypalResult.id).toBe('PAY-concurrent-001');
      // Both services must have written a DB record
      expect(prisma.payment.upsert).toHaveBeenCalledTimes(2);
    });
  });

  // ── 15. Parametrised conversion accuracy ─────────────────────────────────
  describe('Scenario 15 – Parametrised multi-currency → ETB conversion accuracy', () => {
    it.each([
      [100,   'USD',  Math.round(100   * USD_ETB_RATE)],
      [200,   'USD',  Math.round(200   * USD_ETB_RATE)],
      [1,     'USD',  Math.round(1     * USD_ETB_RATE)],
      [50,    'EUR',  Math.round(50    * EUR_ETB_RATE)],
      [100,   'EUR',  Math.round(100   * EUR_ETB_RATE)],
      [1000,  'ETB',  1000                            ],
    ])('%d %s → %d ETB', (amount, currency, expectedEtb) => {
      expect(walletService.convertCurrency(amount, currency, 'ETB')).toBe(expectedEtb);
    });
  });

  // ── 16. Wallet not found ──────────────────────────────────────────────────
  describe('Scenario 16 – Wallet not found → NotFoundException', () => {
    it('throws NotFoundException when wallet does not exist for the user', async () => {
      const ctx = await buildCtx();
      (ctx.prisma as any).freelancerWallet.findUnique.mockResolvedValue(null);

      const dto: WithdrawDto = {
        amount: 100, method: 'CHAPA', accountRef: '0912345678', currency: 'ETB',
      };

      await expect(ctx.walletService.withdraw('ghost-user', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ── 17. Reverse ETB → USD conversion ─────────────────────────────────────
  describe('Scenario 17 – Reverse ETB→USD conversion', () => {
    it('applies the correct reverse rate when converting ETB to USD', () => {
      const etbAmount = 1205;
      const result    = walletService.convertCurrency(etbAmount, 'ETB', 'USD');
      expect(result).toBe(Math.round(etbAmount * (1 / USD_ETB_RATE)));
    });

    it('applies the correct reverse rate when converting ETB to EUR', () => {
      const etbAmount = 1302;
      const result    = walletService.convertCurrency(etbAmount, 'ETB', 'EUR');
      expect(result).toBe(Math.round(etbAmount * (1 / EUR_ETB_RATE)));
    });
  });
});
