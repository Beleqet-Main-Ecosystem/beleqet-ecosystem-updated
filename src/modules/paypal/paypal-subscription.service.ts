import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { PaypalAuthService } from './paypal-auth.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { sanitiseForStorage } from './paypal-pii.utils';

/**
 * @class PaypalSubscriptionService
 * @module PayPal
 * @description Manages the PayPal Subscriptions API v1 lifecycle.
 *
 * **Supported operations**:
 * - `createSubscription()` — initiates a billing agreement with a PayPal Plan ID
 *   and returns the buyer approval URL.
 * - `suspendSubscription()` — temporarily pauses billing (reversible).
 * - `cancelSubscription()` — permanently terminates a subscription (irreversible).
 *
 * **State persistence**: All state changes are persisted in `paypal_subscriptions`
 * for audit and webhook reconciliation. The status field mirrors PayPal's subscription
 * lifecycle states: `APPROVAL_PENDING → ACTIVE → SUSPENDED → CANCELLED / EXPIRED`.
 *
 * **Webhook integration**: Final status transitions (e.g. `ACTIVE`, `EXPIRED`) arrive
 * via `BILLING.SUBSCRIPTION.*` webhook events processed in `PaypalProcessor`. The
 * `createSubscription()` result has status `APPROVAL_PENDING` until the webhook fires.
 *
 * **GDPR**: Raw PayPal Subscriptions API responses stored in `gatewayResponse` are
 * passed through `sanitiseForStorage()` which SHA-256 pseudonymises buyer email
 * addresses and redacts name/phone/address fields before database persistence.
 *
 * **Mock mode**: When `PAYPAL_MODE=mock`, no external API calls are made. A simulator
 * URL is returned for the frontend's offline demonstration flow.
 *
 * @see {@link https://developer.paypal.com/docs/api/subscriptions/v1/} Subscriptions API v1
 *
 * @example
 * ```ts
 * // Create a monthly subscription:
 * const sub = await subscriptionSvc.createSubscription('user-uuid', {
 *   planId: 'P-5ML4271244454362WXNWU5NQ',
 *   planLabel: 'MONTHLY',
 * });
 * // sub.approveUrl → redirect user to this URL for consent
 *
 * // After user approves (webhook will set status to ACTIVE):
 * await subscriptionSvc.suspendSubscription('user-uuid', sub.subscriptionId);
 * await subscriptionSvc.cancelSubscription('user-uuid', sub.subscriptionId);
 * ```
 */
@Injectable()
export class PaypalSubscriptionService {
  private readonly logger = new Logger(PaypalSubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: PaypalAuthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Creates a PayPal subscription for the given user and billing plan.
   *
   * The user **must** be redirected to the returned `approveUrl` to complete
   * activation in their PayPal account. Once approved, PayPal fires a
   * `BILLING.SUBSCRIPTION.ACTIVATED` webhook which the `PaypalProcessor` handles
   * to update the local status from `APPROVAL_PENDING` to `ACTIVE`.
   *
   * **GDPR**: The PayPal response stored in `gatewayResponse` is passed through
   * `sanitiseForStorage()` before persistence.
   *
   * **Mock mode**: Returns a simulator URL instead of a PayPal approval URL.
   * No external API call is made.
   *
   * @param userId - UUID of the authenticated user who will be the subscriber
   * @param dto    - Subscription creation payload (PayPal Plan ID and optional label)
   * @returns Object containing `{ localId, subscriptionId, approveUrl, planId, planLabel }`
   * @throws {BadRequestException} If PayPal rejects the subscription creation request
   *
   * @example
   * ```ts
   * const result = await subscriptionSvc.createSubscription('user-uuid', {
   *   planId: 'P-5ML4271244454362WXNWU5NQ',
   *   planLabel: 'MONTHLY',
   * });
   * // result.approveUrl → 'https://www.sandbox.paypal.com/webapps/billing/subscriptions/...'
   * // result.localId → UUID of the PaypalSubscription row
   * ```
   */
  async createSubscription(userId: string, dto: CreateSubscriptionDto) {
    const returnUrl = this.config.get<string>(
      'PAYPAL_RETURN_URL',
      'http://localhost:3000/payment-success',
    );
    const cancelUrl = this.config.get<string>(
      'PAYPAL_CANCEL_URL',
      'http://localhost:3000/payment-cancel',
    );

    let paypalSubId: string;
    let approveUrl: string;
    let rawResponse: unknown;

    const mode = this.config.get<string>('PAYPAL_MODE', 'sandbox');

    if (mode === 'mock') {
      paypalSubId = `MOCK-SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
      approveUrl  = `${frontendUrl}/paypal-mock-checkout?subscriptionId=${paypalSubId}&planId=${dto.planId}&type=subscription`;
      rawResponse = { status: 'APPROVAL_PENDING', simulated: true };
    } else {
      const token   = await this.auth.getAccessToken();
      const baseUrl = this.auth.getBaseUrl();

      try {
        const response = await axios.post<{
          id: string;
          links: { rel: string; href: string }[];
        }>(
          `${baseUrl}/v1/billing/subscriptions`,
          {
            plan_id: dto.planId,
            application_context: {
              brand_name:          'Beleqet',
              locale:              'en-US',
              shipping_preference: 'NO_SHIPPING',
              user_action:         'SUBSCRIBE_NOW',
              return_url:          returnUrl,
              cancel_url:          cancelUrl,
            },
          },
          {
            headers: {
              Authorization:  `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept:         'application/json',
              'Prefer':       'return=representation',
            },
          },
        );

        rawResponse = response.data;
        paypalSubId = response.data.id;
        const approveLink = response.data.links.find((l) => l.rel === 'approve');
        if (!approveLink) {
          throw new BadRequestException(
            'PayPal did not return an approve link for the subscription',
          );
        }
        approveUrl = approveLink.href;
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        const msg = axios.isAxiosError(err)
          ? JSON.stringify(err.response?.data)
          : String(err);
        this.logger.error(`Failed to create PayPal subscription: ${msg}`);
        throw new BadRequestException(`PayPal subscription creation failed: ${msg}`);
      }
    }

    // Persist initial subscription record (APPROVAL_PENDING until webhook confirms ACTIVE)
    const record = await this.prisma.paypalSubscription.create({
      data: {
        paypalSubscriptionId: paypalSubId,
        paypalPlanId:         dto.planId,
        status:               'APPROVAL_PENDING',
        userId,
        gatewayResponse:      sanitiseForStorage(rawResponse),
      },
    });

    this.logger.log(
      `Subscription created: ${paypalSubId} for user ${userId} on plan ${dto.planId}`,
    );

    return {
      localId:        record.id,
      subscriptionId: paypalSubId,
      approveUrl,
      planId:         dto.planId,
      planLabel:      dto.planLabel,
    };
  }

  /**
   * Suspends an active PayPal subscription, temporarily pausing billing.
   *
   * Suspension is **reversible** — the subscriber can resume later. For permanent
   * termination, use `cancelSubscription()` instead.
   *
   * The local subscription record is updated to `SUSPENDED` with a `suspendedAt`
   * timestamp. In mock mode, only the database is updated (no API call).
   *
   * @param userId         - UUID of the authenticated user who owns the subscription
   * @param subscriptionId - PayPal Subscription ID (e.g. `'I-BW452GLLEP1G'`)
   * @returns Updated `PaypalSubscription` Prisma record with `status: 'SUSPENDED'`
   * @throws {NotFoundException}   If the subscription is not found for this user
   * @throws {BadRequestException} If PayPal rejects the suspend request
   *
   * @example
   * ```ts
   * const updated = await subscriptionSvc.suspendSubscription(
   *   'user-uuid',
   *   'I-BW452GLLEP1G',
   * );
   * // updated.status → 'SUSPENDED'
   * // updated.suspendedAt → Date object
   * ```
   */
  async suspendSubscription(userId: string, subscriptionId: string) {
    const record = await this.findOwnedSubscription(userId, subscriptionId);

    const mode = this.config.get<string>('PAYPAL_MODE', 'sandbox');

    if (mode !== 'mock') {
      const token   = await this.auth.getAccessToken();
      const baseUrl = this.auth.getBaseUrl();

      try {
        await axios.post(
          `${baseUrl}/v1/billing/subscriptions/${subscriptionId}/suspend`,
          { reason: 'Suspended by subscriber via Beleqet platform' },
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
        );
      } catch (err) {
        const msg = axios.isAxiosError(err)
          ? JSON.stringify(err.response?.data)
          : String(err);
        this.logger.error(`Failed to suspend subscription ${subscriptionId}: ${msg}`);
        throw new BadRequestException(`PayPal suspend failed: ${msg}`);
      }
    }

    const updated = await this.prisma.paypalSubscription.update({
      where: { id: record.id },
      data:  { status: 'SUSPENDED', suspendedAt: new Date() },
    });

    this.logger.log(`Subscription ${subscriptionId} suspended for user ${userId}`);
    return updated;
  }

  /**
   * Permanently cancels a PayPal subscription.
   *
   * **This operation is irreversible.** The subscriber will not be billed again
   * after cancellation. A cancelled subscription cannot be reactivated — a new
   * subscription must be created.
   *
   * The local subscription record is updated to `CANCELLED` with a `cancelledAt`
   * timestamp. In mock mode, only the database is updated (no API call).
   *
   * @param userId         - UUID of the authenticated user who owns the subscription
   * @param subscriptionId - PayPal Subscription ID (e.g. `'I-BW452GLLEP1G'`)
   * @returns Updated `PaypalSubscription` Prisma record with `status: 'CANCELLED'`
   * @throws {NotFoundException}   If the subscription is not found for this user
   * @throws {BadRequestException} If PayPal rejects the cancel request
   *
   * @example
   * ```ts
   * const updated = await subscriptionSvc.cancelSubscription(
   *   'user-uuid',
   *   'I-BW452GLLEP1G',
   * );
   * // updated.status → 'CANCELLED'
   * // updated.cancelledAt → Date object
   * ```
   */
  async cancelSubscription(userId: string, subscriptionId: string) {
    const record = await this.findOwnedSubscription(userId, subscriptionId);

    const mode = this.config.get<string>('PAYPAL_MODE', 'sandbox');

    if (mode !== 'mock') {
      const token   = await this.auth.getAccessToken();
      const baseUrl = this.auth.getBaseUrl();

      try {
        await axios.post(
          `${baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`,
          { reason: 'Cancelled by subscriber via Beleqet platform' },
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
        );
      } catch (err) {
        const msg = axios.isAxiosError(err)
          ? JSON.stringify(err.response?.data)
          : String(err);
        this.logger.error(`Failed to cancel subscription ${subscriptionId}: ${msg}`);
        throw new BadRequestException(`PayPal cancel failed: ${msg}`);
      }
    }

    const updated = await this.prisma.paypalSubscription.update({
      where: { id: record.id },
      data:  { status: 'CANCELLED', cancelledAt: new Date() },
    });

    this.logger.log(`Subscription ${subscriptionId} cancelled for user ${userId}`);
    return updated;
  }

  /**
   * Fetches a subscription record owned by `userId` and validates ownership.
   *
   * This private helper is used by `suspendSubscription` and `cancelSubscription`
   * to ensure a user can only modify their own subscriptions.
   *
   * @param userId         - Must match the subscription's `userId` field
   * @param subscriptionId - PayPal Subscription ID to look up
   * @returns The `PaypalSubscription` Prisma record if found and owned by `userId`
   * @throws {NotFoundException} If the subscription does not exist or belongs to a different user
   *
   * @example
   * ```ts
   * // Private — used internally only:
   * const record = await this.findOwnedSubscription('user-uuid', 'I-BW452GLLEP1G');
   * // throws NotFoundException if not found or not owned by 'user-uuid'
   * ```
   */
  private async findOwnedSubscription(userId: string, subscriptionId: string) {
    const record = await this.prisma.paypalSubscription.findFirst({
      where: { paypalSubscriptionId: subscriptionId, userId },
    });
    if (!record) {
      throw new NotFoundException(
        `Subscription ${subscriptionId} not found for user ${userId}`,
      );
    }
    return record;
  }
}
