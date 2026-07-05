import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { PaypalAuthService } from './paypal-auth.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { sanitiseForStorage } from './paypal-pii.utils';
import { isMockOnlyCurrency } from './paypal-currency.utils';

/**
 * Platform fee percentage applied to all PayPal one-time transactions.
 * The fee is calculated on the gross amount and stored in the transaction record.
 * It does **not** affect the charge amount sent to PayPal — the fee is tracked
 * internally for reconciliation and payout calculations.
 */
const PLATFORM_FEE_PCT = 0.05; // 5%

/**
 * @class PaypalOrderService
 * @module PayPal
 * @description Handles the PayPal Orders API v2 lifecycle.
 *
 * **Flow**:
 * 1. `createOrder()` — creates a PayPal Order, stores a `CREATED` transaction record,
 *    and returns the buyer approval URL.
 * 2. `captureOrder()` — finalises the charge after the buyer has approved the order
 *    at the PayPal approval URL, and updates the transaction to `CAPTURED`.
 *
 * **Idempotency**: The `idempotencyKey` field (auto-generated or client-supplied) is
 * persisted as a unique constraint and also sent as the `PayPal-Request-Id` header to
 * prevent duplicate orders on client retries.
 *
 * **GDPR**: Raw PayPal API responses stored in `gatewayResponse` are passed through
 * `sanitiseForStorage()` which SHA-256 pseudonymises buyer email addresses and redacts
 * all other PII fields before database persistence.
 *
 * **Mock mode**: When `PAYPAL_MODE=mock`, the service generates local order and capture
 * IDs and returns a simulator URL without any external network call. ETB (Ethiopian Birr)
 * is accepted in mock mode only — the service blocks ETB for live/sandbox API calls.
 *
 * @see {@link https://developer.paypal.com/docs/api/orders/v2/} Orders API v2 Reference
 *
 * @example
 * ```ts
 * // Create order:
 * const result = await orderSvc.createOrder('client-uuid', {
 *   amount: 150.0,
 *   currency: 'USD',
 *   idempotencyKey: 'my-unique-key-abc',
 * });
 * // result.approveUrl → redirect the buyer to this URL
 *
 * // After buyer approves:
 * const capture = await orderSvc.captureOrder('client-uuid', result.orderId);
 * // capture.status → 'CAPTURED'
 * ```
 */
@Injectable()
export class PaypalOrderService {
  private readonly logger = new Logger(PaypalOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: PaypalAuthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Creates a PayPal Order and stores a `CREATED` transaction record in the database.
   *
   * **Idempotency**: If a transaction with the same `idempotencyKey` already exists,
   * a `409 ConflictException` is thrown. The client should use a new key for retries
   * unless retrieving the existing order is the intended behaviour.
   *
   * **ETB guard**: If the currency is `ETB` and the mode is not `mock`, a
   * `BadRequestException` is thrown because PayPal does not support ETB on its
   * live or sandbox APIs.
   *
   * **GDPR**: The PayPal response stored in `gatewayResponse` is passed through
   * `sanitiseForStorage()` which pseudonymises buyer email addresses and redacts
   * name/address fields before persistence.
   *
   * @param clientId   - UUID of the authenticated user initiating the payment
   * @param dto        - Order creation payload (amount, currency, optional associations)
   * @returns Object containing `{ transactionId, orderId, approveUrl, amount, currency, platformFee }`
   * @throws {ConflictException}   If the `idempotencyKey` has already been used
   * @throws {BadRequestException} If PayPal rejects the order or if ETB is used in non-mock mode
   *
   * @example
   * ```ts
   * const { orderId, approveUrl } = await orderSvc.createOrder('user-uuid', {
   *   amount: 75.00,
   *   currency: 'EUR',
   *   freelancerId: 'freelancer-uuid',
   *   freelanceJobId: 'job-uuid',
   * });
   * // Redirect the buyer to approveUrl
   * ```
   */
  async createOrder(clientId: string, dto: CreateOrderDto) {
    const idempotencyKey = dto.idempotencyKey ?? uuidv4();

    // Guard against duplicate submissions
    const existing = await this.prisma.paypalTransaction.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      throw new ConflictException(
        `Idempotency key "${idempotencyKey}" has already been used. ` +
          'Use a different key or retrieve the existing order.',
      );
    }

    const mode = this.config.get<string>('PAYPAL_MODE', 'sandbox');

    // Block ETB for live/sandbox — it is only valid in mock/simulator mode
    if (isMockOnlyCurrency(dto.currency) && mode !== 'mock') {
      throw new BadRequestException(
        `Currency "${dto.currency}" is only supported in simulator (mock) mode. ` +
          'PayPal does not support this currency on live/sandbox APIs.',
      );
    }

    const returnUrl = this.config.get<string>(
      'PAYPAL_RETURN_URL',
      'http://localhost:3000/payment-success',
    );
    const cancelUrl = this.config.get<string>(
      'PAYPAL_CANCEL_URL',
      'http://localhost:3000/payment-cancel',
    );

    const platformFee = +(dto.amount * PLATFORM_FEE_PCT).toFixed(2);

    let paypalOrderId: string;
    let approveUrl: string;
    let rawResponse: unknown;

    if (mode === 'mock') {
      paypalOrderId = `MOCK-ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
      approveUrl = `${frontendUrl}/paypal-mock-checkout?orderId=${paypalOrderId}&amount=${dto.amount}&currency=${dto.currency}&type=order`;
      rawResponse = { status: 'CREATED', simulated: true };
    } else {
      const token   = await this.auth.getAccessToken();
      const baseUrl = this.auth.getBaseUrl();

      try {
        const response = await axios.post<{
          id: string;
          links: { rel: string; href: string }[];
        }>(
          `${baseUrl}/v2/checkout/orders`,
          {
            intent: 'CAPTURE',
            purchase_units: [
              {
                amount: {
                  currency_code: dto.currency,
                  value: dto.amount.toFixed(2),
                },
                description: 'Beleqet Freelance Payment',
              },
            ],
            application_context: {
              return_url:          returnUrl,
              cancel_url:          cancelUrl,
              brand_name:          'Beleqet',
              user_action:         'PAY_NOW',
              shipping_preference: 'NO_SHIPPING',
            },
          },
          {
            headers: {
              Authorization:     `Bearer ${token}`,
              'Content-Type':    'application/json',
              'PayPal-Request-Id': idempotencyKey,
            },
          },
        );

        rawResponse   = response.data;
        paypalOrderId = response.data.id;
        const approveLink = response.data.links.find((l) => l.rel === 'approve');
        if (!approveLink) {
          throw new BadRequestException('PayPal did not return an approve link');
        }
        approveUrl = approveLink.href;
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        const msg = axios.isAxiosError(err)
          ? JSON.stringify(err.response?.data)
          : String(err);
        this.logger.error(`Failed to create PayPal order: ${msg}`);
        throw new BadRequestException(`PayPal order creation failed: ${msg}`);
      }
    }

    // Persist the transaction — PII in gatewayResponse is pseudonymised via sanitiseForStorage()
    const tx = await this.prisma.paypalTransaction.create({
      data: {
        paypalOrderId,
        status:          'CREATED',
        amount:          dto.amount,
        currency:        dto.currency,
        platformFee,
        idempotencyKey,
        clientId,
        freelancerId:    dto.freelancerId   ?? null,
        freelanceJobId:  dto.freelanceJobId ?? null,
        gatewayResponse: sanitiseForStorage(rawResponse),
      },
    });

    this.logger.log(
      `PayPal order created: ${paypalOrderId} for client ${clientId} — ${dto.currency} ${dto.amount}`,
    );

    return {
      transactionId: tx.id,
      orderId:       paypalOrderId,
      approveUrl,
      amount:        dto.amount,
      currency:      dto.currency,
      platformFee,
    };
  }

  /**
   * Captures an approved PayPal order, finalising the charge on the buyer's account.
   *
   * This method is **idempotent**: if the order has already been captured, the cached
   * result is returned immediately without calling the PayPal API again.
   *
   * The ownership check (`clientId` must match the stored transaction) prevents one
   * user from capturing another user's order.
   *
   * **GDPR**: The capture response stored in `gatewayResponse` is PII-sanitised via
   * `sanitiseForStorage()` before persistence.
   *
   * @param clientId - UUID of the authenticated user who owns this order
   * @param orderId  - PayPal Order ID to capture (e.g. `'5O190127TN364715T'`)
   * @returns Object containing `{ transactionId, orderId, captureId, status, amount, currency }`
   * @throws {NotFoundException}   If no local transaction matches the order ID for this client
   * @throws {BadRequestException} If the PayPal capture call is rejected
   *
   * @example
   * ```ts
   * const result = await orderSvc.captureOrder('client-uuid', '5O190127TN364715T');
   * // result → { status: 'CAPTURED', captureId: '3C679366HH908993F', ... }
   *
   * // On retry (already captured):
   * const same = await orderSvc.captureOrder('client-uuid', '5O190127TN364715T');
   * // same → { status: 'CAPTURED', ... } (returned from DB cache, no API call)
   * ```
   */
  async captureOrder(clientId: string, orderId: string) {
    // Verify the order belongs to this client
    const tx = await this.prisma.paypalTransaction.findFirst({
      where: { paypalOrderId: orderId, clientId },
    });
    if (!tx) {
      throw new NotFoundException(
        `No transaction found for order ${orderId} belonging to user ${clientId}`,
      );
    }

    // Idempotency — already captured
    if (tx.status === 'CAPTURED') {
      this.logger.debug(`Order ${orderId} already captured — returning cached result`);
      return { status: 'CAPTURED', captureId: tx.paypalCaptureId, transactionId: tx.id };
    }

    const mode = this.config.get<string>('PAYPAL_MODE', 'sandbox');

    let captureId: string;
    let captureStatus: string;
    let rawResponse: unknown;

    if (mode === 'mock') {
      captureId     = `MOCK-CAP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      captureStatus = 'COMPLETED';
      rawResponse   = { status: 'COMPLETED', simulated: true };
    } else {
      const token   = await this.auth.getAccessToken();
      const baseUrl = this.auth.getBaseUrl();

      try {
        const response = await axios.post<{
          status: string;
          purchase_units: { payments: { captures: { id: string; status: string }[] } }[];
        }>(
          `${baseUrl}/v2/checkout/orders/${orderId}/capture`,
          {},
          {
            headers: {
              Authorization:  `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        );

        rawResponse   = response.data;
        captureStatus = response.data.status;
        captureId     = response.data.purchase_units[0]?.payments?.captures?.[0]?.id ?? '';
      } catch (err) {
        const msg = axios.isAxiosError(err)
          ? JSON.stringify(err.response?.data)
          : String(err);
        this.logger.error(`Failed to capture PayPal order ${orderId}: ${msg}`);
        throw new BadRequestException(`PayPal capture failed: ${msg}`);
      }
    }

    const newStatus =
      captureStatus === 'COMPLETED' ? 'CAPTURED' : 'FAILED';

    // Persist — buyer PII in rawResponse is pseudonymised before storage
    const updated = await this.prisma.paypalTransaction.update({
      where: { id: tx.id },
      data: {
        paypalCaptureId: captureId || null,
        status:          newStatus,
        gatewayResponse: sanitiseForStorage(rawResponse),
      },
    });

    this.logger.log(
      `PayPal order ${orderId} ${newStatus} — captureId: ${captureId}`,
    );

    return {
      transactionId: updated.id,
      orderId,
      captureId,
      status:   newStatus,
      amount:   updated.amount,
      currency: updated.currency,
    };
  }
}
