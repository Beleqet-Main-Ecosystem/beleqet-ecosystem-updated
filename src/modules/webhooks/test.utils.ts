/**
 * @fileoverview Test utilities and helpers for webhook testing
 * @module webhooks/test-utils
 */

import * as crypto from 'crypto';
import { PaymentProvider, WebhookEventType, WebhookVerificationResult } from './types/webhook.types';

/**
 * Generate a valid Stripe signature for testing
 *
 * @param body - Request body as string
 * @param secret - Webhook secret
 * @param timestamp - Unix timestamp in seconds
 * @returns Stripe signature header value
 *
 * @example
 * const signature = generateStripeSignature(JSON.stringify(payload), 'secret', Math.floor(Date.now() / 1000));
 * // Returns: "t=1234567890,v1=abc123..."
 */
export function generateStripeSignature(
  body: string,
  secret: string,
  timestamp: number,
): string {
  const signedContent = `${timestamp}.${body}`;
  const signature = crypto.createHmac('sha256', secret).update(signedContent).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

/**
 * Generate a valid PayPal signature for testing
 *
 * @param payload - Webhook payload object
 * @param secret - Webhook secret
 * @param transmissionId - Transmission ID
 * @param transmissionTime - Transmission time
 * @param webhookId - Webhook ID
 * @returns PayPal signature header value
 *
 * @example
 * const signature = generatePayPalSignature(payload, secret, tx_id, time, webhook_id);
 */
export function generatePayPalSignature(
  payload: Record<string, any>,
  secret: string,
  transmissionId: string,
  transmissionTime: string,
  webhookId: string,
): string {
  const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const verificationString = [transmissionId, transmissionTime, webhookId, payloadHash].join('|');
  return crypto.createHmac('sha256', secret).update(verificationString).digest('base64');
}

/**
 * Generate a valid Chapa signature for testing
 *
 * @param payload - Webhook payload object
 * @param secret - Webhook secret
 * @returns Chapa signature header value
 *
 * @example
 * const signature = generateChapaSignature(payload, 'secret');
 */
export function generateChapaSignature(payload: Record<string, any>, secret: string): string {
  const payloadString = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
}

/**
 * Create a mock Stripe webhook payload for testing
 *
 * @param type - Event type (e.g., 'charge.succeeded')
 * @param data - Custom data to merge
 * @returns Stripe event payload
 *
 * @example
 * const payload = createStripePayload('charge.succeeded', { amount: 2000 });
 */
export function createStripePayload(
  type: string,
  data?: Record<string, any>,
): Record<string, any> {
  return {
    id: `evt_${generateId()}`,
    object: 'event',
    api_version: '2020-08-27',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: `ch_${generateId()}`,
        object: 'charge',
        amount: 2000,
        currency: 'usd',
        customer: `cus_${generateId()}`,
        status: 'succeeded',
        ...data,
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: null,
      idempotency_key: null,
    },
    type,
  };
}

/**
 * Create a mock PayPal webhook payload for testing
 *
 * @param eventType - Event type (e.g., 'PAYMENT.CAPTURE.COMPLETED')
 * @param data - Custom data to merge
 * @returns PayPal event payload
 *
 * @example
 * const payload = createPayPalPayload('PAYMENT.CAPTURE.COMPLETED', { amount: 20 });
 */
export function createPayPalPayload(
  eventType: string,
  data?: Record<string, any>,
): Record<string, any> {
  return {
    id: `WH_${generateId()}`,
    event_version: '1.0',
    create_time: new Date().toISOString(),
    event_type: eventType,
    resource_type: 'checkout-order',
    resource: {
      id: `cap_${generateId()}`,
      status: 'COMPLETED',
      amount: {
        value: '20.00',
        currency_code: 'USD',
      },
      ...data,
    },
    links: [
      {
        rel: 'self',
        href: `https://api.sandbox.paypal.com/v1/notifications/webhooks-events/WH_${generateId()}`,
        method: 'GET',
      },
    ],
  };
}

/**
 * Create a mock Chapa webhook payload for testing
 *
 * @param event - Event type (e.g., 'charge.success')
 * @param data - Custom data to merge
 * @returns Chapa event payload
 *
 * @example
 * const payload = createChapaPayload('charge.success', { amount: 500 });
 */
export function createChapaPayload(event: string, data?: Record<string, any>): Record<string, any> {
  return {
    event,
    data: {
      first_name: 'Test',
      last_name: 'User',
      email: 'test@example.com',
      currency: 'ETB',
      amount: 500,
      charge: 0,
      status: event === 'charge.success' ? 'success' : 'failed',
      reference: `ref_${generateId()}`,
      tx_ref: `tx_${generateId()}`,
      customization: {
        title: 'Test Payment',
      },
      meta: {},
      ...data,
    },
  };
}

/**
 * Create a mock verification result for testing
 *
 * @param provider - Payment provider
 * @param eventType - Event type
 * @param payload - Custom payload
 * @returns WebhookVerificationResult
 *
 * @example
 * const result = createVerificationResult(PaymentProvider.STRIPE, WebhookEventType.PAYMENT_SUCCESS);
 */
export function createVerificationResult(
  provider: PaymentProvider,
  eventType: WebhookEventType,
  payload?: Record<string, any>,
): WebhookVerificationResult {
  return {
    isValid: true,
    provider,
    eventType,
    payload: payload || { id: generateId() },
    timestamp: new Date(),
    idempotencyKey: generateId(),
  };
}

/**
 * Create a mock wallet transaction for testing
 *
 * @param overrides - Properties to override
 * @returns Mock wallet transaction object
 *
 * @example
 * const transaction = createMockTransaction({ amount: 100, currency: 'USD' });
 */
export function createMockTransaction(overrides?: Record<string, any>) {
  return {
    id: `txn_${generateId()}`,
    externalTransactionId: `ext_${generateId()}`,
    walletId: `wallet_${generateId()}`,
    userId: `user_${generateId()}`,
    amount: 50,
    currency: 'USD',
    status: 'completed',
    metadata: {},
    wallet: {
      userId: `user_${generateId()}`,
      currency: 'USD',
      availableBalance: 1000,
    },
    ...overrides,
  };
}

/**
 * Create a mock user for testing
 *
 * @param overrides - Properties to override
 * @returns Mock user object
 *
 * @example
 * const user = createMockUser({ email: 'custom@example.com' });
 */
export function createMockUser(overrides?: Record<string, any>) {
  return {
    id: `user_${generateId()}`,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    phone: '1234567890',
    createdAt: new Date(),
    gdprConsentDate: new Date(),
    gdprConsentRevoked: false,
    gdprConsentRevokedAt: null,
    ...overrides,
  };
}

/**
 * Generate a random ID for testing
 *
 * @param prefix - Optional prefix
 * @returns Generated ID
 *
 * @example
 * const id = generateId('txn');
 * // Returns: "txn_abc123def456"
 */
export function generateId(prefix = ''): string {
  const id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * Wait for a specified number of milliseconds
 *
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after specified time
 *
 * @example
 * await delay(1000); // Wait 1 second
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock logger for testing
 *
 * @returns Mock logger object
 *
 * @example
 * const logger = createMockLogger();
 * expect(logger.log).toHaveBeenCalled();
 */
export function createMockLogger() {
  return {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };
}

/**
 * Create a mock ConfigService for testing
 *
 * @param config - Configuration values
 * @returns Mock ConfigService
 *
 * @example
 * const configService = createMockConfigService({
 *   STRIPE_WEBHOOK_SECRET: 'whsec_test_...'
 * });
 */
export function createMockConfigService(config: Record<string, any> = {}) {
  return {
    get: jest.fn((key: string) => config[key]),
    getOrThrow: jest.fn((key: string) => config[key] || new Error(`Config key not found: ${key}`)),
  };
}

/**
 * Create a mock EventEmitter for testing
 *
 * @returns Mock EventEmitter2
 *
 * @example
 * const emitter = createMockEventEmitter();
 * expect(emitter.emit).toHaveBeenCalledWith('webhook.processed', data);
 */
export function createMockEventEmitter() {
  return {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
    removeAllListeners: jest.fn(),
  };
}

/**
 * Create a mock Queue for testing
 *
 * @returns Mock BullMQ Queue
 *
 * @example
 * const queue = createMockQueue();
 * expect(queue.add).toHaveBeenCalled();
 */
export function createMockQueue() {
  return {
    add: jest.fn().mockResolvedValue({ id: generateId('job') }),
    process: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  };
}

/**
 * Assert that a value matches expected structure
 *
 * @param actual - Actual value
 * @param expected - Expected structure
 *
 * @example
 * assertMatches(result, {
 *   isValid: true,
 *   provider: PaymentProvider.STRIPE,
 * });
 */
export function assertMatches(actual: any, expected: Record<string, any>): void {
  Object.entries(expected).forEach(([key, value]) => {
    expect(actual[key]).toEqual(value);
  });
}

/**
 * Create a mock Prisma client for testing
 *
 * @returns Mock Prisma service
 *
 * @example
 * const prisma = createMockPrisma();
 * expect(prisma.walletTransaction.findFirst).toHaveBeenCalled();
 */
export function createMockPrisma() {
  return {
    walletTransaction: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    freelancerWallet: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    paymentTransaction: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      create: jest.fn(),
    },
    webhookLog: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    gdprConsent: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };
}
