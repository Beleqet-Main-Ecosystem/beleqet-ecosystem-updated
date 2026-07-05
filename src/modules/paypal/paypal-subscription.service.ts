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

/**
 * Manages the PayPal Subscriptions API lifecycle:
 * - Create a subscription and get the buyer approval URL
 * - Suspend a subscription (temporarily stop billing)
 * - Cancel a subscription (permanent termination)
 *
 * All state changes are persisted in `paypal_subscriptions` for audit.
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
   * The user must be redirected to the returned `approveUrl` to complete
   * activation in their PayPal account.
   *
   * @param userId - Authenticated user who will subscribe
   * @param dto    - Subscription payload containing the PayPal plan ID
   * @returns `{ subscriptionId, approveUrl, localId }` — redirect user to `approveUrl`
   * @throws BadRequestException if PayPal rejects the subscription request
   */
  async createSubscription(userId: string, dto: CreateSubscriptionDto) {
    const token   = await this.auth.getAccessToken();
    const baseUrl = this.auth.getBaseUrl();

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

    try {
      const response = await axios.post<{
        id: string;
        links: { rel: string; href: string }[];
      }>(
        `${baseUrl}/v1/billing/subscriptions`,
        {
          plan_id: dto.planId,
          application_context: {
            brand_name: 'Beleqet',
            locale: 'en-US',
            shipping_preference: 'NO_SHIPPING',
            user_action: 'SUBSCRIBE_NOW',
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Prefer': 'return=representation',
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

    // Persist initial subscription record (status: APPROVAL_PENDING until webhook)
    const record = await this.prisma.paypalSubscription.create({
      data: {
        paypalSubscriptionId: paypalSubId,
        paypalPlanId:         dto.planId,
        status:               'APPROVAL_PENDING',
        userId,
        gatewayResponse: rawResponse as object,
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
   * Suspends an active PayPal subscription (billing paused but not cancelled).
   * Suspension is reversible; use `cancel` for permanent termination.
   *
   * @param userId         - Authenticated user who owns the subscription
   * @param subscriptionId - PayPal Subscription ID to suspend
   * @returns Updated local subscription record
   * @throws NotFoundException   if the subscription is not found for this user
   * @throws BadRequestException if PayPal rejects the suspend request
   */
  async suspendSubscription(userId: string, subscriptionId: string) {
    const record = await this.findOwnedSubscription(userId, subscriptionId);

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

    const updated = await this.prisma.paypalSubscription.update({
      where: { id: record.id },
      data:  { status: 'SUSPENDED', suspendedAt: new Date() },
    });

    this.logger.log(`Subscription ${subscriptionId} suspended for user ${userId}`);
    return updated;
  }

  /**
   * Permanently cancels a PayPal subscription.
   * The subscriber will not be billed again.
   *
   * @param userId         - Authenticated user who owns the subscription
   * @param subscriptionId - PayPal Subscription ID to cancel
   * @returns Updated local subscription record with `CANCELLED` status
   * @throws NotFoundException   if the subscription is not found for this user
   * @throws BadRequestException if PayPal rejects the cancel request
   */
  async cancelSubscription(userId: string, subscriptionId: string) {
    const record = await this.findOwnedSubscription(userId, subscriptionId);

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

    const updated = await this.prisma.paypalSubscription.update({
      where: { id: record.id },
      data:  { status: 'CANCELLED', cancelledAt: new Date() },
    });

    this.logger.log(`Subscription ${subscriptionId} cancelled for user ${userId}`);
    return updated;
  }

  /**
   * Fetches a subscription owned by `userId` or throws NotFoundException.
   *
   * @param userId         - Must match the subscription's userId
   * @param subscriptionId - PayPal Subscription ID
   * @throws NotFoundException if not found or not owned by this user
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
