/**
 * @file subscriptions.service.ts
 * @description
 * Owns the Subscription lifecycle: checkout, cancellation, and syncing
 * state from gateway webhook events (PayPal today, extensible to other
 * gateways later — see `syncFromProviderEvent`).
 *
 * Design note: this service is intentionally gateway-agnostic. It does not
 * import PaypalService/StripeService — instead, PaymentsModule (PayPal) and
 * BillingModule (generic/future gateways) depend on SubscriptionsService and
 * call `syncFromProviderEvent` with a normalised event type, keeping the
 * dependency direction one-way (Payments/Billing -> Subscriptions) and
 * avoiding a circular module import.
 */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PaymentProvider,
  PaymentStatus,
  SubscriptionStatus,
  BillingInterval,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Normalised lifecycle events a gateway webhook can report for a subscription. */
export type SubscriptionLifecycleEvent =
  'ACTIVATED' | 'RENEWED' | 'PAYMENT_FAILED' | 'CANCELLED' | 'EXPIRED';

export interface SyncFromProviderEventInput {
  /** Gateway's own event id — used for webhook idempotency (WebhookEvent.gatewayEventId). */
  gatewayEventId: string;
  provider: PaymentProvider;
  eventType: SubscriptionLifecycleEvent;
  /** Gateway-side recurring-billing id, joins Subscription.providerSubscriptionId. */
  providerSubscriptionId: string;
  /** Charge amount for this event, in minor units — omitted for non-charge events. */
  amount?: number;
  currency?: string;
  /** Provider-side reference for this specific charge (e.g. PayPal sale id). */
  gatewayReference?: string;
  /** Raw webhook payload, already sanitised of PII by the caller. */
  rawPayload?: Record<string, unknown>;
}

function addInterval(date: Date, interval: BillingInterval): Date {
  const next = new Date(date);
  if (interval === 'YEARLY') {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Returns the current (most recent) subscription for a user, or null. */
  findMine(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
  }

  /** Admin view: all subscriptions, optionally filtered by status. */
  findAllForAdmin(status?: SubscriptionStatus) {
    return this.prisma.subscription.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }

  /**
   * Creates a PENDING local Subscription row linked to a gateway
   * recurring-billing id. Called by SubscriptionsController after the
   * gateway checkout call (e.g. PaypalService.createSubscription) succeeds —
   * the row is promoted to ACTIVE once the gateway's activation webhook
   * arrives via `syncFromProviderEvent`.
   */
  async createPendingCheckout(params: {
    userId: string;
    planId: string;
    provider: PaymentProvider;
    providerSubscriptionId: string;
  }) {
    const plan = await this.prisma.plan.findUnique({ where: { id: params.planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    return this.prisma.subscription.create({
      data: {
        userId: params.userId,
        planId: params.planId,
        status: SubscriptionStatus.PENDING,
        provider: params.provider,
        providerSubscriptionId: params.providerSubscriptionId,
        // Placeholder period, corrected to the real cycle end once the
        // gateway confirms activation.
        currentPeriodStart: new Date(),
        currentPeriodEnd: addInterval(new Date(), plan.interval),
      },
    });
  }

  /** Guards checkout against a user starting a second concurrent subscription. */
  async assertNoActiveSubscription(userId: string): Promise<void> {
    const existing = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.PENDING],
        },
      },
    });
    if (existing) {
      throw new ConflictException('You already have an active or pending subscription');
    }
  }

  /**
   * User-initiated cancellation. Sets `cancelAtPeriodEnd` so access continues
   * until the paid-for period ends, rather than revoking immediately — the
   * gateway-side agreement is cancelled by the caller (SubscriptionsController)
   * before this is called. PAST_DUE is cancellable too: a failed renewal
   * charge shouldn't trap the user into being unable to leave — sweepExpired
   * still resolves it to CANCELLED (rather than EXPIRED) once its period ends.
   */
  async cancel(id: string, userId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { id } });
    if (!subscription || subscription.userId !== userId) {
      throw new NotFoundException('Subscription not found');
    }
    if (
      subscription.status !== SubscriptionStatus.ACTIVE &&
      subscription.status !== SubscriptionStatus.PAST_DUE
    ) {
      throw new BadRequestException('Only an active or past-due subscription can be cancelled');
    }
    return this.prisma.subscription.update({
      where: { id },
      data: { cancelAtPeriodEnd: true },
    });
  }

  /**
   * Applies a normalised gateway lifecycle event to the matching local
   * Subscription, idempotently (via the WebhookEvent table) and inside a
   * single DB transaction so the Subscription update and its ledger entry
   * never partially apply.
   */
  async syncFromProviderEvent(input: SyncFromProviderEventInput): Promise<void> {
    const alreadyProcessed = await this.recordWebhookEvent(input);
    if (alreadyProcessed) {
      this.logger.log(`Webhook event ${input.gatewayEventId} already processed — skipping`);
      return;
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { providerSubscriptionId: input.providerSubscriptionId },
      include: { plan: true },
    });
    if (!subscription) {
      this.logger.warn(
        `No local subscription found for providerSubscriptionId=${input.providerSubscriptionId} (event=${input.eventType})`,
      );
      return;
    }

    const now = new Date();
    const statusUpdate = this.resolveStatusUpdate(input.eventType, subscription, now);

    await this.prisma.$transaction(async (tx) => {
      if (statusUpdate) {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: statusUpdate,
        });
      }

      if (input.amount !== undefined && input.currency) {
        await tx.subscriptionTransaction.create({
          data: {
            subscriptionId: subscription.id,
            amount: input.amount,
            currency: input.currency,
            status: this.mapEventToTransactionStatus(input.eventType),
            gatewayReference: input.gatewayReference,
            rawPayload: input.rawPayload as Prisma.InputJsonValue | undefined,
          },
        });
      }
    });

    this.logger.log(
      `Subscription ${subscription.id} synced from ${input.provider} event ${input.eventType}`,
    );
  }

  /** @returns true if this gateway event id was already processed (idempotent no-op). */
  private async recordWebhookEvent(input: SyncFromProviderEventInput): Promise<boolean> {
    try {
      await this.prisma.webhookEvent.create({
        data: {
          gatewayEventId: input.gatewayEventId,
          provider: input.provider,
          eventType: input.eventType,
          payload: (input.rawPayload ?? {}) as Prisma.InputJsonValue,
        },
      });
      return false;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return true;
      }
      throw err;
    }
  }

  private resolveStatusUpdate(
    eventType: SubscriptionLifecycleEvent,
    subscription: { plan: { interval: BillingInterval }; cancelAtPeriodEnd: boolean },
    now: Date,
  ): Prisma.SubscriptionUpdateInput | null {
    switch (eventType) {
      case 'ACTIVATED':
      case 'RENEWED':
        return {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: addInterval(now, subscription.plan.interval),
          reminderSentAt: null,
        };
      case 'PAYMENT_FAILED':
        return { status: SubscriptionStatus.PAST_DUE };
      case 'CANCELLED':
        // A user-initiated cancel (SubscriptionsCheckoutService.cancel) sets
        // cancelAtPeriodEnd before telling the gateway to stop future
        // charges — that call alone fires this same CANCELLED webhook, so
        // treating it as an immediate revocation here would cut off access
        // the user already paid for. Leave status untouched; sweepExpired
        // flips it to CANCELLED once currentPeriodEnd actually passes.
        if (subscription.cancelAtPeriodEnd) return null;
        return { status: SubscriptionStatus.CANCELLED };
      case 'EXPIRED':
        return { status: SubscriptionStatus.EXPIRED };
    }
  }

  private mapEventToTransactionStatus(eventType: SubscriptionLifecycleEvent): PaymentStatus {
    switch (eventType) {
      case 'ACTIVATED':
      case 'RENEWED':
        return PaymentStatus.SUCCEEDED;
      case 'PAYMENT_FAILED':
        return PaymentStatus.FAILED;
      case 'CANCELLED':
      case 'EXPIRED':
        return PaymentStatus.CANCELLED;
    }
  }

  /**
   * Daily cron sweep (called by SchedulerService): resolves every ACTIVE or
   * PAST_DUE subscription whose period has ended. PAST_DUE is included
   * alongside ACTIVE because a failed renewal charge leaves currentPeriodEnd
   * in the past immediately — without it, PAST_DUE subscriptions would never
   * be picked up again and stay in limbo forever. Subscriptions the user
   * already cancelled (cancelAtPeriodEnd) become CANCELLED — access was
   * always scheduled to stop here. Everything else becomes EXPIRED — the
   * safety net for subscriptions that never received a matching gateway
   * webhook (e.g. the payer never approved a renewal at all).
   *
   * @returns the subscriptions that were just resolved, for notification.
   */
  async sweepExpired(
    now = new Date(),
  ): Promise<Array<{ id: string; userId: string; planName: string }>> {
    const due = await this.prisma.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE] },
        currentPeriodEnd: { lt: now },
      },
      select: { id: true, userId: true, cancelAtPeriodEnd: true, plan: { select: { name: true } } },
    });

    if (due.length === 0) return [];

    const cancelledIds = due.filter((s) => s.cancelAtPeriodEnd).map((s) => s.id);
    const lapsedIds = due.filter((s) => !s.cancelAtPeriodEnd).map((s) => s.id);

    if (cancelledIds.length > 0) {
      await this.prisma.subscription.updateMany({
        where: { id: { in: cancelledIds } },
        data: { status: SubscriptionStatus.CANCELLED },
      });
    }
    if (lapsedIds.length > 0) {
      await this.prisma.subscription.updateMany({
        where: { id: { in: lapsedIds } },
        data: { status: SubscriptionStatus.EXPIRED },
      });
    }

    return due.map((s) => ({ id: s.id, userId: s.userId, planName: s.plan.name }));
  }

  /**
   * Cron entrypoint (3 days before expiry): returns subscriptions that need
   * an expiry reminder and marks them as notified, so the caller can send
   * the notification without re-querying (and without double-sending on
   * the next run — `reminderSentAt` is reset whenever a period renews).
   */
  async findAndMarkDueForReminder(
    daysAhead = 3,
    now = new Date(),
  ): Promise<Array<{ id: string; userId: string; planName: string; currentPeriodEnd: Date }>> {
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + daysAhead);

    const due = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        reminderSentAt: null,
        currentPeriodEnd: { lte: threshold, gt: now },
      },
      select: { id: true, userId: true, currentPeriodEnd: true, plan: { select: { name: true } } },
    });

    if (due.length === 0) return [];

    await this.prisma.subscription.updateMany({
      where: { id: { in: due.map((s) => s.id) } },
      data: { reminderSentAt: now },
    });

    return due.map((s) => ({
      id: s.id,
      userId: s.userId,
      planName: s.plan.name,
      currentPeriodEnd: s.currentPeriodEnd,
    }));
  }
}
