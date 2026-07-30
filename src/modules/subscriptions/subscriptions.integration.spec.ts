/**
 * @file subscriptions.integration.spec.ts
 * @description
 * Integration test: checkout → PayPal webhook → active subscription →
 * expiry sweep, wired exactly as it runs in production —
 * PaypalService emits a `billing.subscription.lifecycle` event that
 * BillingService consumes via @OnEvent (see paypal.service.ts /
 * billing.service.ts) — no direct DI edge between PaymentsModule and
 * Subscriptions/BillingModule.
 *
 * Only true external boundaries are mocked: the PayPal SDK and Prisma
 * (an in-memory fake store standing in for Postgres). Everything else —
 * PaypalService, SubscriptionsService, SubscriptionsCheckoutService,
 * BillingService, and the real EventEmitter2 — runs unmocked.
 */
jest.mock('paypal-rest-sdk', () => ({
  configure: jest.fn(),
  payment: { create: jest.fn(), execute: jest.fn() },
  billingAgreement: { create: jest.fn(), cancel: jest.fn() },
  notification: { webhookEvent: { verify: jest.fn() } },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as paypal from 'paypal-rest-sdk';

import { Prisma } from '@prisma/client';
import { PaypalService } from '../payments/paypal.service';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsCheckoutService } from './subscriptions-checkout.service';
import { BillingService } from '../billing/billing.service';
import { WalletService } from '../wallet/wallet.service';
import { PrismaService } from '../../prisma/prisma.service';

/** Minimal in-memory stand-in for Prisma covering just what this flow touches. */
function createFakePrisma() {
  const plans = new Map<string, any>();
  const subscriptions = new Map<string, any>();
  const webhookEvents = new Set<string>();
  const transactions: any[] = [];
  let nextId = 1;

  // Test double is relation-aware: any subscription record returned to the
  // service layer carries a resolved `plan` (the service reads plan.interval
  // / plan.name off `include`/`select` results), matching real Prisma.
  const withPlan = (record: any) => (record ? { ...record, plan: plans.get(record.planId) } : null);

  const subscriptionApi = {
    create: jest.fn(async ({ data }: any) => {
      const record = { id: `sub-${nextId++}`, ...data };
      subscriptions.set(record.id, record);
      return withPlan(record);
    }),
    findUnique: jest.fn(async ({ where }: any) => {
      if (where.id) return withPlan(subscriptions.get(where.id) ?? null);
      if (where.providerSubscriptionId) {
        return withPlan(
          [...subscriptions.values()].find(
            (s) => s.providerSubscriptionId === where.providerSubscriptionId,
          ) ?? null,
        );
      }
      return null;
    }),
    findFirst: jest.fn(async ({ where }: any) => {
      const matches = [...subscriptions.values()]
        .filter((s) => (where.userId ? s.userId === where.userId : true))
        .filter((s) => {
          if (!where.status) return true;
          const statuses = where.status.in ?? [where.status];
          return statuses.includes(s.status);
        });
      // findMine orders by createdAt desc — our Map preserves insertion order,
      // so the last match is the most recently created.
      return withPlan(matches[matches.length - 1] ?? null);
    }),
    findMany: jest.fn(async ({ where }: any) => {
      return [...subscriptions.values()]
        .filter((s) => {
          if (!where?.status) return true;
          const statuses = where.status.in ?? [where.status];
          return statuses.includes(s.status);
        })
        .filter((s) =>
          where?.currentPeriodEnd?.lt ? s.currentPeriodEnd < where.currentPeriodEnd.lt : true,
        )
        .map(withPlan);
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const record = subscriptions.get(where.id);
      Object.assign(record, data);
      return withPlan(record);
    }),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const ids: string[] = where.id.in;
      ids.forEach((id) => Object.assign(subscriptions.get(id), data));
      return { count: ids.length };
    }),
  };

  return {
    plan: {
      findUnique: jest.fn(async ({ where }: any) => plans.get(where.id) ?? null),
      __seed: (plan: any) => plans.set(plan.id, plan),
    },
    subscription: subscriptionApi,
    webhookEvent: {
      create: jest.fn(async ({ data }: any) => {
        if (webhookEvents.has(data.gatewayEventId)) {
          throw new Prisma.PrismaClientKnownRequestError('duplicate', {
            code: 'P2002',
            clientVersion: '5.22.0',
          });
        }
        webhookEvents.add(data.gatewayEventId);
        return data;
      }),
    },
    subscriptionTransaction: {
      create: jest.fn(async ({ data }: any) => {
        transactions.push(data);
        return data;
      }),
    },
    // Overridden per-test in beforeEach once subscriptionTransaction exists.
    $transaction: jest.fn(async (cb: any) => cb(subscriptionApi)),
    __internal: { plans, subscriptions, transactions },
  };
}

describe('Subscription checkout -> webhook -> active flow (integration)', () => {
  let moduleRef: TestingModule;
  let prisma: ReturnType<typeof createFakePrisma>;
  let checkoutService: SubscriptionsCheckoutService;
  let subscriptionsService: SubscriptionsService;

  beforeEach(async () => {
    prisma = createFakePrisma();
    // $transaction needs access to the real create/update mocks, including subscriptionTransaction.
    prisma.$transaction = jest.fn(async (cb: any) =>
      cb({
        subscription: prisma.subscription,
        subscriptionTransaction: prisma.subscriptionTransaction,
      }),
    );

    const configValues: Record<string, string> = {
      PAYPAL_CLIENT_ID: 'test-client-id',
      PAYPAL_CLIENT_SECRET: 'test-secret',
      BILLING_WEBHOOK_SECRET: '',
    };
    const config = {
      get: jest.fn((key: string, fallback?: unknown) => configValues[key] ?? fallback),
      getOrThrow: jest.fn((key: string) => {
        const value = configValues[key];
        if (!value) throw new Error(`Missing config: ${key}`);
        return value;
      }),
    };

    moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        PaypalService,
        SubscriptionsService,
        SubscriptionsCheckoutService,
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: WalletService, useValue: { convertCurrency: jest.fn() } },
      ],
    }).compile();

    // Required so @nestjs/event-emitter's EventSubscribersLoader registers
    // BillingService's @OnEvent listener before any event is emitted.
    await moduleRef.init();

    checkoutService = moduleRef.get(SubscriptionsCheckoutService);
    subscriptionsService = moduleRef.get(SubscriptionsService);

    prisma.plan.__seed({
      id: 'plan-pro',
      name: 'Pro',
      isActive: true,
      paypalPlanId: 'P-PRO-PLAN',
      priceAmount: 99900,
      currency: 'ETB',
      interval: 'MONTHLY',
    });
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('activates the subscription once PayPal confirms the billing agreement', async () => {
    (paypal.billingAgreement.create as jest.Mock).mockImplementation((_attrs, cb) => {
      cb(null, {
        id: 'I-AGREEMENT-1',
        state: 'Pending',
        links: [{ rel: 'approval_url', href: 'https://paypal.example/approve' }],
      });
    });

    const { subscription, approvalUrl } = await checkoutService.checkout('user-1', {
      planId: 'plan-pro',
    });

    expect(approvalUrl).toBe('https://paypal.example/approve');
    expect(subscription.status).toBe('PENDING');

    // Simulate PayPal's webhook controller delivering BILLING.SUBSCRIPTION.ACTIVATED —
    // this is exactly what PaypalWebhookController -> PaypalService.handleWebhook does.
    const paypalService = moduleRef.get(PaypalService);
    await (paypalService as any).processWebhookEvent({
      id: 'webhook-evt-1',
      event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
      resource_type: 'agreement',
      summary: 'Agreement activated',
      resource: { id: 'I-AGREEMENT-1' },
      create_time: new Date().toISOString(),
    });

    const activated = await subscriptionsService.findMine('user-1');
    expect(activated?.status).toBe('ACTIVE');
  });

  it('is idempotent when PayPal redelivers the same webhook event id', async () => {
    (paypal.billingAgreement.create as jest.Mock).mockImplementation((_attrs, cb) => {
      cb(null, { id: 'I-AGREEMENT-2', state: 'Pending', links: [] });
    });

    await checkoutService.checkout('user-2', { planId: 'plan-pro' });
    const paypalService = moduleRef.get(PaypalService);
    const event = {
      id: 'webhook-evt-2',
      event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
      resource_type: 'agreement',
      summary: 'Agreement activated',
      resource: { id: 'I-AGREEMENT-2' },
      create_time: new Date().toISOString(),
    };

    await (paypalService as any).processWebhookEvent(event);
    const afterFirst = await subscriptionsService.findMine('user-2');

    await (paypalService as any).processWebhookEvent(event);
    const afterSecond = await subscriptionsService.findMine('user-2');

    expect(afterFirst?.currentPeriodEnd).toEqual(afterSecond?.currentPeriodEnd);
  });

  it('does not revoke access when PayPal confirms the cancellation the user already requested', async () => {
    (paypal.billingAgreement.create as jest.Mock).mockImplementation((_attrs, cb) => {
      cb(null, {
        id: 'I-AGREEMENT-3',
        state: 'Pending',
        links: [{ rel: 'approval_url', href: 'https://paypal.example/approve' }],
      });
    });
    (paypal.billingAgreement.cancel as jest.Mock).mockImplementation((_id, _opts, cb) => cb(null));

    await checkoutService.checkout('user-4', { planId: 'plan-pro' });
    const paypalService = moduleRef.get(PaypalService);
    await (paypalService as any).processWebhookEvent({
      id: 'webhook-evt-3',
      event_type: 'BILLING.SUBSCRIPTION.ACTIVATED',
      resource_type: 'agreement',
      summary: 'Agreement activated',
      resource: { id: 'I-AGREEMENT-3' },
      create_time: new Date().toISOString(),
    });

    const activeSubscription = await subscriptionsService.findMine('user-4');
    expect(activeSubscription?.status).toBe('ACTIVE');

    // User cancels: this sets cancelAtPeriodEnd and tells PayPal to stop
    // future charges — which, in production, triggers PayPal's own
    // BILLING.SUBSCRIPTION.CANCELLED webhook straight away.
    await checkoutService.cancel(activeSubscription!.id, 'user-4');

    await (paypalService as any).processWebhookEvent({
      id: 'webhook-evt-4',
      event_type: 'BILLING.SUBSCRIPTION.CANCELLED',
      resource_type: 'agreement',
      summary: 'Agreement cancelled',
      resource: { id: 'I-AGREEMENT-3' },
      create_time: new Date().toISOString(),
    });

    const afterGatewayCancel = await subscriptionsService.findMine('user-4');
    expect(afterGatewayCancel?.status).toBe('ACTIVE');
    expect(afterGatewayCancel?.cancelAtPeriodEnd).toBe(true);
  });

  it('the daily sweep expires an ACTIVE subscription whose period has ended', async () => {
    await prisma.subscription.create({
      data: {
        userId: 'user-3',
        planId: 'plan-pro',
        status: 'ACTIVE',
        currentPeriodStart: new Date('2026-06-01'),
        currentPeriodEnd: new Date('2026-06-30'),
      },
    });

    const expired = await subscriptionsService.sweepExpired(new Date('2026-07-21'));

    expect(expired).toHaveLength(1);
    expect(expired[0].planName).toBe('Pro');
  });

  it('the daily sweep also resolves a PAST_DUE subscription stuck past its period end, and lets it be cancelled', async () => {
    const pastDue = await prisma.subscription.create({
      data: {
        userId: 'user-5',
        planId: 'plan-pro',
        status: 'PAST_DUE',
        provider: 'PAYPAL',
        providerSubscriptionId: 'I-AGREEMENT-5',
        currentPeriodStart: new Date('2026-06-01'),
        currentPeriodEnd: new Date('2026-06-30'),
      },
    });

    // Previously, cancel() rejected anything but ACTIVE, trapping the user.
    await expect(checkoutService.cancel(pastDue.id, 'user-5')).resolves.toMatchObject({
      cancelAtPeriodEnd: true,
    });

    // Previously, sweepExpired only queried ACTIVE, so a PAST_DUE
    // subscription past its period end would never be resolved.
    const resolved = await subscriptionsService.sweepExpired(new Date('2026-07-21'));

    expect(resolved.map((s) => s.id)).toContain(pastDue.id);
    const afterSweep = await prisma.subscription.findUnique({ where: { id: pastDue.id } });
    expect(afterSweep?.status).toBe('CANCELLED');
  });
});
