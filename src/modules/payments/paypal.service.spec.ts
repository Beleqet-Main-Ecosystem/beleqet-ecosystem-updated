/**
 * @file paypal.service.spec.ts
 * @description
 * Unit tests for PaypalService — Global Payment Gateway (Task ID: Global-Payments-002).
 *
 * All external I/O (paypal-rest-sdk, Prisma) is fully mocked so no live
 * network calls or DB connections are required.
 *
 * Coverage:
 *  - createOrder  (happy path, subscription delegation, error handling)
 *  - captureOrder (happy path, missing payerId, failed capture)
 *  - createSubscription (happy path, missing planId)
 *  - handleWebhook (all event types, signature verification, skip when no webhookId)
 *  - GDPR: userId stored as custom_id, not raw PII
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PaypalService } from './paypal.service';
import { PrismaService } from '../../prisma/prisma.service';

// ─────────────────────────────────────────────────────────────────────────────
// paypal-rest-sdk mock
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('paypal-rest-sdk', () => ({
  configure:        jest.fn(),
  payment:          { create: jest.fn(), execute: jest.fn() },
  billingAgreement: { create: jest.fn() },
  notification:     { webhookEvent: { verify: jest.fn() } },
}));

import * as paypal from 'paypal-rest-sdk';

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

function makePaypalPayment(id = 'PAY-test-001') {
  return {
    id,
    state: 'created',
    links: [
      { rel: 'approval_url', href: `https://sandbox.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token=${id}` },
      { rel: 'self',         href: `https://api.sandbox.paypal.com/v1/payments/payment/${id}` },
    ],
  };
}

function makePaypalExecuted(state = 'approved') {
  return {
    state,
    transactions: [
      {
        related_resources: [
          { sale: { id: 'SALE-test-001', state: 'completed' } },
        ],
      },
    ],
  };
}

function makePaypalBillingAgreement(id = 'I-TEST-001') {
  return {
    id,
    state: 'Pending',
    name:  'Beleqet Subscription',
    links: [
      { rel: 'approval_url', href: `https://sandbox.paypal.com/agreements/approvalSession/${id}` },
    ],
  };
}

function makeWebhookEvent(eventType: string, resourceId = 'PAY-evt-001') {
  return {
    id:            `WH-${eventType.replace(/\./g, '-')}`,
    event_type:    eventType,
    resource_type: 'payment',
    summary:       `${eventType} event`,
    resource:      { id: resourceId },
    create_time:   new Date().toISOString(),
  };
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
    PAYPAL_CLIENT_ID:      'paypal_client_id_mock',
    PAYPAL_CLIENT_SECRET:  'paypal_client_secret_mock',
    PAYPAL_MODE:           'sandbox',
    PAYPAL_WEBHOOK_ID:     '',
    PAYPAL_RETURN_URL:     'https://beleqet.com/payment/success',
    PAYPAL_CANCEL_URL:     'https://beleqet.com/payment/cancel',
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

async function buildModule(configExtra: Record<string, string> = {}): Promise<{
  service: PaypalService;
  prisma:  ReturnType<typeof buildMockPrisma>;
}> {
  const prisma  = buildMockPrisma();
  const config  = buildMockConfig(configExtra);

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      PaypalService,
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigService, useValue: config },
    ],
  }).compile();

  return {
    service: module.get<PaypalService>(PaypalService),
    prisma,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('PaypalService', () => {
  let service: PaypalService;
  let prisma:  ReturnType<typeof buildMockPrisma>;

  beforeEach(async () => {
    const ctx = await buildModule();
    service   = ctx.service;
    prisma    = ctx.prisma;
  });

  afterEach(() => jest.clearAllMocks());

  // ──────────────────────────────────────────────────────────────────────────
  // Initialisation
  // ──────────────────────────────────────────────────────────────────────────
  describe('Initialisation', () => {
    it('calls paypal.configure with the correct credentials on module init', async () => {
      await buildModule();
      expect(paypal.configure).toHaveBeenCalledWith(
        expect.objectContaining({
          mode:          'sandbox',
          client_id:     'paypal_client_id_mock',
          client_secret: 'paypal_client_secret_mock',
        }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // createOrder
  // ──────────────────────────────────────────────────────────────────────────
  describe('createOrder', () => {
    it('creates a PayPal order and returns an approval URL', async () => {
      (paypal.payment.create as jest.Mock).mockImplementation(
        (_d: unknown, cb: Function) => cb(null, makePaypalPayment()),
      );

      const result = await service.createOrder({
        amount: 25.00, currency: 'USD', userId: 'user-uuid-001',
      });

      expect(result.id).toBe('PAY-test-001');
      expect(result.status).toBe('created');
      expect(result.approvalUrl).toContain('sandbox.paypal.com');
      expect(result.currency).toBe('USD');
    });

    it('stores the amount in cents in the DB', async () => {
      (paypal.payment.create as jest.Mock).mockImplementation(
        (_d: unknown, cb: Function) => cb(null, makePaypalPayment()),
      );

      await service.createOrder({ amount: 25.00, currency: 'USD', userId: 'u' });

      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            amount:   2500, // 25.00 * 100
            currency: 'USD',
            status:   'PENDING',
            provider: 'PAYPAL',
          }),
        }),
      );
    });

    it('uses userId as the custom field (GDPR — no raw PII)', async () => {
      let capturedData: any;
      (paypal.payment.create as jest.Mock).mockImplementation(
        (data: unknown, cb: Function) => {
          capturedData = data;
          cb(null, makePaypalPayment());
        },
      );

      await service.createOrder({ amount: 10, currency: 'USD', userId: 'my-uuid-gdpr' });

      expect(capturedData.transactions[0].custom).toBe('my-uuid-gdpr');
    });

    it('uses provided returnUrl and cancelUrl when supplied', async () => {
      let capturedData: any;
      (paypal.payment.create as jest.Mock).mockImplementation(
        (data: unknown, cb: Function) => {
          capturedData = data;
          cb(null, makePaypalPayment());
        },
      );

      await service.createOrder({
        amount:    10,
        currency:  'USD',
        userId:    'u',
        returnUrl: 'https://custom-return.com',
        cancelUrl: 'https://custom-cancel.com',
      });

      expect(capturedData.redirect_urls.return_url).toBe('https://custom-return.com');
      expect(capturedData.redirect_urls.cancel_url).toBe('https://custom-cancel.com');
    });

    it('falls back to config return/cancel URLs when not provided in DTO', async () => {
      let capturedData: any;
      (paypal.payment.create as jest.Mock).mockImplementation(
        (data: unknown, cb: Function) => {
          capturedData = data;
          cb(null, makePaypalPayment());
        },
      );

      await service.createOrder({ amount: 10, currency: 'USD', userId: 'u' });

      expect(capturedData.redirect_urls.return_url).toBe('https://beleqet.com/payment/success');
    });

    it('delegates to createSubscription when subscriptionPlanId is provided', async () => {
      (paypal.billingAgreement.create as jest.Mock).mockImplementation(
        (_d: unknown, cb: Function) => cb(null, makePaypalBillingAgreement()),
      );

      const result = await service.createOrder({
        amount:             9.99,
        currency:           'USD',
        userId:             'user-sub',
        subscriptionPlanId: 'plan-monthly-001',
      });

      expect(paypal.billingAgreement.create).toHaveBeenCalled();
      expect(result.id).toBe('I-TEST-001');
    });

    it('throws InternalServerErrorException when PayPal SDK returns an error', async () => {
      (paypal.payment.create as jest.Mock).mockImplementation(
        (_d: unknown, cb: Function) =>
          cb({ name: 'INTERNAL_SERVICE_ERROR', message: 'PayPal error' }, null),
      );

      await expect(
        service.createOrder({ amount: 10, currency: 'USD', userId: 'u' }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('returns null approvalUrl when no approval_url link is found', async () => {
      const paymentWithoutLink = { id: 'PAY-no-link', state: 'created', links: [] };
      (paypal.payment.create as jest.Mock).mockImplementation(
        (_d: unknown, cb: Function) => cb(null, paymentWithoutLink),
      );

      const result = await service.createOrder({ amount: 10, currency: 'USD', userId: 'u' });

      expect(result.approvalUrl).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // captureOrder
  // ──────────────────────────────────────────────────────────────────────────
  describe('captureOrder', () => {
    it('captures an approved order and returns success result', async () => {
      (paypal.payment.execute as jest.Mock).mockImplementation(
        (_id: string, _d: unknown, cb: Function) => cb(null, makePaypalExecuted()),
      );

      const result = await service.captureOrder({ orderId: 'PAY-test-001' }, 'PAYERID-ABC');

      expect(result.orderId).toBe('PAY-test-001');
      expect(result.status).toBe('approved');
      expect(result.captureId).toBe('SALE-test-001');
      expect(result).toHaveProperty('capturedAt');
    });

    it('updates DB status to SUCCEEDED after successful capture', async () => {
      (paypal.payment.execute as jest.Mock).mockImplementation(
        (_id: string, _d: unknown, cb: Function) => cb(null, makePaypalExecuted()),
      );

      await service.captureOrder({ orderId: 'PAY-test-001' }, 'PAYERID-ABC');

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ providerPaymentId: 'PAY-test-001' }),
          data:  expect.objectContaining({ status: 'SUCCEEDED' }),
        }),
      );
    });

    it('updates DB status to FAILED if capture state is not approved', async () => {
      (paypal.payment.execute as jest.Mock).mockImplementation(
        (_id: string, _d: unknown, cb: Function) =>
          cb(null, makePaypalExecuted('failed')),
      );

      await service.captureOrder({ orderId: 'PAY-test-001' }, 'PAYERID-ABC');

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('throws BadRequestException when payerId is empty string', async () => {
      await expect(
        service.captureOrder({ orderId: 'PAY-test-001' }, ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerErrorException when PayPal execute fails', async () => {
      (paypal.payment.execute as jest.Mock).mockImplementation(
        (_id: string, _d: unknown, cb: Function) =>
          cb({ name: 'PAYMENT_ALREADY_DONE', message: 'Already captured' }, null),
      );

      await expect(
        service.captureOrder({ orderId: 'PAY-test-001' }, 'PAYERID-ABC'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('returns null captureId when transactions have no sale resource', async () => {
      const noSale = { state: 'approved', transactions: [{ related_resources: [] }] };
      (paypal.payment.execute as jest.Mock).mockImplementation(
        (_id: string, _d: unknown, cb: Function) => cb(null, noSale),
      );

      const result = await service.captureOrder({ orderId: 'PAY-test-001' }, 'PAYERID-ABC');

      expect(result.captureId).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // createSubscription
  // ──────────────────────────────────────────────────────────────────────────
  describe('createSubscription', () => {
    it('creates a billing agreement and returns the approval URL', async () => {
      (paypal.billingAgreement.create as jest.Mock).mockImplementation(
        (_d: unknown, cb: Function) => cb(null, makePaypalBillingAgreement()),
      );

      const result = await service.createSubscription({
        amount:             9.99,
        currency:           'USD',
        userId:             'user-sub-001',
        subscriptionPlanId: 'plan-beleqet-premium',
      });

      expect(result.id).toBe('I-TEST-001');
      expect(result.planId).toBe('plan-beleqet-premium');
      expect(result.approvalUrl).toContain('approvalSession');
      expect(result).toHaveProperty('createdAt');
    });

    it('persists the subscription as a PENDING payment record', async () => {
      (paypal.billingAgreement.create as jest.Mock).mockImplementation(
        (_d: unknown, cb: Function) => cb(null, makePaypalBillingAgreement()),
      );

      await service.createSubscription({
        amount:             9.99,
        currency:           'USD',
        userId:             'user-sub-001',
        subscriptionPlanId: 'plan-beleqet-premium',
      });

      expect(prisma.payment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status:   'PENDING',
            provider: 'PAYPAL',
          }),
        }),
      );
    });

    it('throws BadRequestException when subscriptionPlanId is missing', async () => {
      await expect(
        service.createSubscription({
          amount: 9.99, currency: 'USD', userId: 'u',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerErrorException when billingAgreement.create fails', async () => {
      (paypal.billingAgreement.create as jest.Mock).mockImplementation(
        (_d: unknown, cb: Function) =>
          cb({ name: 'INVALID_PLAN_ID', message: 'Plan not found' }, null),
      );

      await expect(
        service.createSubscription({
          amount: 9.99, currency: 'USD', userId: 'u', subscriptionPlanId: 'bad-plan',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('returns null approvalUrl when billing agreement has no approval link', async () => {
      const noLink = { id: 'I-NO-LINK', state: 'Pending', links: [] };
      (paypal.billingAgreement.create as jest.Mock).mockImplementation(
        (_d: unknown, cb: Function) => cb(null, noLink),
      );

      const result = await service.createSubscription({
        amount: 9.99, currency: 'USD', userId: 'u', subscriptionPlanId: 'plan-x',
      });

      expect(result.approvalUrl).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // handleWebhook
  // ──────────────────────────────────────────────────────────────────────────
  describe('handleWebhook', () => {
    it('processes PAYMENT.CAPTURE.COMPLETED → SUCCEEDED', async () => {
      await service.handleWebhook(makeWebhookEvent('PAYMENT.CAPTURE.COMPLETED') as any, {});

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SUCCEEDED' }),
        }),
      );
    });

    it('processes PAYMENT.SALE.COMPLETED → SUCCEEDED', async () => {
      await service.handleWebhook(makeWebhookEvent('PAYMENT.SALE.COMPLETED') as any, {});

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCEEDED' }) }),
      );
    });

    it('processes PAYMENT.CAPTURE.DENIED → FAILED', async () => {
      await service.handleWebhook(makeWebhookEvent('PAYMENT.CAPTURE.DENIED') as any, {});

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
      );
    });

    it('processes PAYMENT.SALE.REVERSED → FAILED', async () => {
      await service.handleWebhook(makeWebhookEvent('PAYMENT.SALE.REVERSED') as any, {});

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
      );
    });

    it('processes PAYMENT.CAPTURE.REFUNDED → REFUNDED', async () => {
      await service.handleWebhook(makeWebhookEvent('PAYMENT.CAPTURE.REFUNDED') as any, {});

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'REFUNDED' }) }),
      );
    });

    it('processes BILLING.SUBSCRIPTION.ACTIVATED → SUCCEEDED', async () => {
      await service.handleWebhook(makeWebhookEvent('BILLING.SUBSCRIPTION.ACTIVATED') as any, {});

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCEEDED' }) }),
      );
    });

    it('processes BILLING.SUBSCRIPTION.CANCELLED → CANCELLED', async () => {
      await service.handleWebhook(makeWebhookEvent('BILLING.SUBSCRIPTION.CANCELLED') as any, {});

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }),
      );
    });

    it('processes BILLING.SUBSCRIPTION.EXPIRED → CANCELLED', async () => {
      await service.handleWebhook(makeWebhookEvent('BILLING.SUBSCRIPTION.EXPIRED') as any, {});

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }),
      );
    });

    it('handles unrecognised event types without throwing', async () => {
      const result = await service.handleWebhook(
        makeWebhookEvent('CUSTOMER.DISPUTE.CREATED') as any, {},
      );
      expect(result.event_type).toBe('CUSTOMER.DISPUTE.CREATED');
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('skips signature verification when PAYPAL_WEBHOOK_ID is not set', async () => {
      // Default buildModule has PAYPAL_WEBHOOK_ID = ''
      await service.handleWebhook(makeWebhookEvent('PAYMENT.SALE.COMPLETED') as any, {});

      expect((paypal.notification.webhookEvent as any).verify).not.toHaveBeenCalled();
    });

    it('verifies signature when PAYPAL_WEBHOOK_ID is configured', async () => {
      const { service: svc } = await buildModule({ PAYPAL_WEBHOOK_ID: 'wh-123-abc' });

      (paypal.notification.webhookEvent as any).verify = jest.fn(
        (_data: unknown, cb: Function) => cb(null, { verification_status: 'SUCCESS' }),
      );

      await svc.handleWebhook(makeWebhookEvent('PAYMENT.SALE.COMPLETED') as any, {
        'paypal-transmission-id':   'tx-001',
        'paypal-transmission-time': new Date().toISOString(),
        'paypal-cert-url':          'https://api.paypal.com/cert',
        'paypal-auth-algo':         'SHA256withRSA',
        'paypal-transmission-sig':  'sig-base64',
      });

      expect((paypal.notification.webhookEvent as any).verify).toHaveBeenCalled();
    });

    it('throws UnprocessableEntityException when webhook verification_status is FAILURE', async () => {
      const { service: svc } = await buildModule({ PAYPAL_WEBHOOK_ID: 'wh-123-abc' });

      (paypal.notification.webhookEvent as any).verify = jest.fn(
        (_data: unknown, cb: Function) => cb(null, { verification_status: 'FAILURE' }),
      );

      await expect(
        svc.handleWebhook(makeWebhookEvent('PAYMENT.SALE.COMPLETED') as any, {}),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('throws UnprocessableEntityException when verify SDK call errors', async () => {
      const { service: svc } = await buildModule({ PAYPAL_WEBHOOK_ID: 'wh-123-abc' });

      (paypal.notification.webhookEvent as any).verify = jest.fn(
        (_data: unknown, cb: Function) => cb(new Error('SDK error'), null),
      );

      await expect(
        svc.handleWebhook(makeWebhookEvent('PAYMENT.SALE.COMPLETED') as any, {}),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
