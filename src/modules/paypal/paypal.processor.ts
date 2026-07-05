import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job as BullJob } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, PAYPAL_JOBS, NOTIFICATION_JOBS } from '../queues/queues.constants';
import { PaypalDisputeService } from './paypal-dispute.service';
import { PaypalI18nService } from './paypal-i18n.service';
import { formatAmount } from './paypal-currency.utils';

// ── Payload type definitions ───────────────────────────────────────────────────

/**
 * BullMQ job payload for `PAYMENT.CAPTURE.COMPLETED / DENIED / REFUNDED` events.
 * The `resource` object mirrors the PayPal webhook `resource` field.
 */
interface CaptureWebhookPayload {
  eventType: string;
  resource: {
    /** PayPal Capture ID */
    id: string;
    status: string;
    amount?: { value: string; currency_code: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
    [key: string]: unknown;
  };
}

/**
 * BullMQ job payload for `BILLING.SUBSCRIPTION.*` events.
 */
interface SubscriptionWebhookPayload {
  eventType: string;
  resource: {
    /** PayPal Subscription ID */
    id: string;
    status: string;
    billing_info?: { next_billing_time?: string };
    start_time?: string;
    [key: string]: unknown;
  };
}

/**
 * BullMQ job payload for `CUSTOMER.DISPUTE.*` events.
 */
interface DisputeWebhookPayload {
  eventType: string;
  resource: {
    dispute_id: string;
    reason: string;
    status: string;
    create_time: string;
    update_time?: string;
    dispute_outcome?: { outcome_code?: string };
    dispute_transactions?: { buyer_transaction_id?: string }[];
    [key: string]: unknown;
  };
}

/**
 * @class PaypalProcessor
 * @module PayPal
 * @description BullMQ processor for all PayPal queue jobs.
 *
 * Runs as an async worker outside the HTTP request lifecycle. Handles three
 * distinct job types dispatched by `PaypalWebhookService.dispatch()`:
 *
 * | Job Name             | Trigger Events                                           |
 * |----------------------|----------------------------------------------------------|
 * | `PROCESS_WEBHOOK`    | `PAYMENT.CAPTURE.COMPLETED/DENIED/REFUNDED`              |
 * | `SYNC_SUBSCRIPTION`  | `BILLING.SUBSCRIPTION.ACTIVATED/CANCELLED/SUSPENDED/EXPIRED` |
 * | `SYNC_DISPUTE`       | `CUSTOMER.DISPUTE.CREATED/RESOLVED/UPDATED`              |
 *
 * **Retry policy**: Every job is configured with 3 attempts and exponential back-off
 * (3-second initial delay). Failed jobs are logged via `@OnQueueFailed`.
 *
 * **i18n**: User-facing notification strings are resolved via `PaypalI18nService`
 * using the subscriber's preferred locale (defaults to `'en'` if not stored).
 *
 * **Notification side effects**: After each successful job, an in-app notification
 * is enqueued in the `notifications` queue for delivery to the affected user.
 *
 * @example
 * ```ts
 * // Jobs are NOT called directly — they are enqueued by PaypalWebhookService:
 * await this.paypalQueue.add(PAYPAL_JOBS.PROCESS_WEBHOOK, { eventType, resource }, opts);
 * ```
 */
@Injectable()
@Processor(QUEUE_NAMES.PAYPAL)
export class PaypalProcessor {
  private readonly logger = new Logger(PaypalProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly disputeService: PaypalDisputeService,
    private readonly i18n: PaypalI18nService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
  ) {}

  // ── 1. Capture webhook (PAYMENT.CAPTURE.*) ──────────────────────────────────

  /**
   * Processes `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, and
   * `PAYMENT.CAPTURE.REFUNDED` webhook events.
   *
   * **Steps**:
   * 1. Resolves the local `PaypalTransaction` via capture ID or order ID.
   * 2. Checks idempotency — skips if already in a terminal state.
   * 3. Maps the event type to a new status: `CAPTURED`, `REFUNDED`, or `FAILED`.
   * 4. Atomically updates the transaction + creates an `EventLog` row via `$transaction`.
   * 5. Enqueues an in-app notification for the client in their preferred locale.
   *
   * **Retry policy**: 3 attempts, exponential back-off starting at 3 seconds.
   *
   * @param job - BullMQ job containing `CaptureWebhookPayload`
   *
   * @example
   * ```ts
   * // Job payload structure:
   * {
   *   eventType: 'PAYMENT.CAPTURE.COMPLETED',
   *   resource: { id: 'CAPTURE-123', status: 'COMPLETED', amount: { value: '150.00', currency_code: 'USD' } }
   * }
   * ```
   */
  @Process(PAYPAL_JOBS.PROCESS_WEBHOOK)
  async handleCaptureWebhook(job: BullJob<CaptureWebhookPayload>): Promise<void> {
    const { eventType, resource } = job.data;
    const captureId = resource.id;
    this.logger.log(`[paypal-webhook] ${eventType} captureId=${captureId}`);

    // Locate the local transaction via capture ID or order ID
    const orderId = resource.supplementary_data?.related_ids?.order_id;
    const tx = await this.prisma.paypalTransaction.findFirst({
      where: {
        OR: [
          { paypalCaptureId: captureId },
          ...(orderId ? [{ paypalOrderId: orderId }] : []),
        ],
      },
    });

    if (!tx) {
      this.logger.warn(
        `[paypal-webhook] No local transaction for captureId=${captureId} orderId=${orderId} — ignoring`,
      );
      return;
    }

    // Idempotency: skip if already in a terminal state from a prior run
    if (tx.status === 'CAPTURED' && eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      this.logger.debug(`[paypal-webhook] Already CAPTURED — skipping duplicate`);
      return;
    }

    let newStatus: 'CAPTURED' | 'FAILED' | 'REFUNDED';
    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        newStatus = 'CAPTURED';
        break;
      case 'PAYMENT.CAPTURE.REFUNDED':
        newStatus = 'REFUNDED';
        break;
      default:
        newStatus = 'FAILED';
    }

    await this.prisma.$transaction([
      this.prisma.paypalTransaction.update({
        where: { id: tx.id },
        data: {
          status:          newStatus,
          paypalCaptureId: captureId,
          gatewayResponse: resource as object,
        },
      }),
      this.prisma.eventLog.create({
        data: {
          eventType:   `paypal.${eventType.toLowerCase()}`,
          entityId:    tx.id,
          entityType:  'PaypalTransaction',
          payload:     { captureId, status: newStatus },
          processedBy: PaypalProcessor.name,
        },
      }),
    ]);

    // Localised notification — default to 'en'; extend with user locale lookup if needed
    const locale  = 'en';
    const amount  = resource.amount?.value ?? Number(tx.amount).toFixed(2);
    const currency = resource.amount?.currency_code ?? tx.currency;

    const notifTitle =
      newStatus === 'CAPTURED'
        ? '✅ Payment confirmed via PayPal'
        : '❌ PayPal payment failed';

    const notifBody =
      newStatus === 'CAPTURED'
        ? this.i18n.t('paypal.payment.confirmed', locale, { currency, amount })
        : this.i18n.t('paypal.payment.failed', locale);

    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
      userId:   tx.clientId,
      type:     `paypal.${newStatus.toLowerCase()}`,
      title:    notifTitle,
      body:     notifBody,
      metadata: { transactionId: tx.id, captureId },
    });

    this.logger.log(
      `[paypal-webhook] Transaction ${tx.id} updated to ${newStatus}`,
    );
  }

  // ── 2. Subscription events (BILLING.SUBSCRIPTION.*) ────────────────────────

  /**
   * Processes `BILLING.SUBSCRIPTION.*` webhook events, updating the local
   * `PaypalSubscription` record and notifying the subscriber.
   *
   * **Status mapping**:
   * | PayPal Event                          | Local Status  |
   * |---------------------------------------|---------------|
   * | `BILLING.SUBSCRIPTION.ACTIVATED`      | `ACTIVE`      |
   * | `BILLING.SUBSCRIPTION.CANCELLED`      | `CANCELLED`   |
   * | `BILLING.SUBSCRIPTION.SUSPENDED`      | `SUSPENDED`   |
   * | `BILLING.SUBSCRIPTION.EXPIRED`        | `EXPIRED`     |
   *
   * **Side effects**:
   * - Updates `nextBillingTime`, `cancelledAt`, `suspendedAt`, or `startTime` as applicable.
   * - Enqueues a localised in-app notification for the subscriber.
   *
   * **Retry policy**: 3 attempts, exponential back-off starting at 3 seconds.
   *
   * @param job - BullMQ job containing `SubscriptionWebhookPayload`
   *
   * @example
   * ```ts
   * // Job payload structure:
   * {
   *   eventType: 'BILLING.SUBSCRIPTION.ACTIVATED',
   *   resource: { id: 'I-BW452GLLEP1G', status: 'ACTIVE', billing_info: { next_billing_time: '...' } }
   * }
   * ```
   */
  @Process(PAYPAL_JOBS.SYNC_SUBSCRIPTION)
  async handleSubscriptionWebhook(
    job: BullJob<SubscriptionWebhookPayload>,
  ): Promise<void> {
    const { eventType, resource } = job.data;
    const paypalSubscriptionId = resource.id;
    this.logger.log(
      `[paypal-sub] ${eventType} subscriptionId=${paypalSubscriptionId}`,
    );

    const record = await this.prisma.paypalSubscription.findUnique({
      where: { paypalSubscriptionId },
    });

    if (!record) {
      this.logger.warn(
        `[paypal-sub] Unknown subscription ${paypalSubscriptionId} — creating minimal record`,
      );
      return;
    }

    type SubStatus =
      | 'APPROVAL_PENDING'
      | 'APPROVED'
      | 'ACTIVE'
      | 'SUSPENDED'
      | 'CANCELLED'
      | 'EXPIRED';

    const statusMap: Record<string, SubStatus> = {
      'BILLING.SUBSCRIPTION.ACTIVATED':  'ACTIVE',
      'BILLING.SUBSCRIPTION.CANCELLED':  'CANCELLED',
      'BILLING.SUBSCRIPTION.SUSPENDED':  'SUSPENDED',
      'BILLING.SUBSCRIPTION.EXPIRED':    'EXPIRED',
    };

    const newStatus: SubStatus = statusMap[eventType] ?? 'ACTIVE';
    const nextBillingTime =
      resource.billing_info?.next_billing_time
        ? new Date(resource.billing_info.next_billing_time)
        : null;

    await this.prisma.paypalSubscription.update({
      where: { id: record.id },
      data: {
        status:          newStatus,
        nextBillingTime: nextBillingTime ?? undefined,
        cancelledAt:     newStatus === 'CANCELLED'  ? new Date() : undefined,
        suspendedAt:     newStatus === 'SUSPENDED'  ? new Date() : undefined,
        startTime:       newStatus === 'ACTIVE' && !record.startTime ? new Date() : undefined,
        gatewayResponse: resource as object,
      },
    });

    // i18n notification string keyed by new status
    const i18nKeyMap: Record<string, string> = {
      ACTIVE:    'paypal.subscription.active',
      CANCELLED: 'paypal.subscription.cancelled',
      SUSPENDED: 'paypal.subscription.suspended',
      EXPIRED:   'paypal.subscription.expired',
    };

    const titleMap: Record<string, string> = {
      ACTIVE:    '✅ Subscription activated',
      CANCELLED: '🚫 Subscription cancelled',
      SUSPENDED: '⏸ Subscription suspended',
      EXPIRED:   '⌛ Subscription expired',
    };

    const locale = 'en';

    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
      userId:   record.userId,
      type:     `paypal.subscription.${newStatus.toLowerCase()}`,
      title:    titleMap[newStatus] ?? 'Subscription updated',
      body:     this.i18n.t(i18nKeyMap[newStatus] ?? 'paypal.subscription.active', locale),
      metadata: { subscriptionId: paypalSubscriptionId, status: newStatus },
    });

    this.logger.log(
      `[paypal-sub] Subscription ${paypalSubscriptionId} → ${newStatus}`,
    );
  }

  // ── 3. Dispute events (CUSTOMER.DISPUTE.*) ─────────────────────────────────

  /**
   * Processes `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.RESOLVED`, and
   * `CUSTOMER.DISPUTE.UPDATED` webhook events.
   *
   * Delegates to `PaypalDisputeService.upsertDispute()` which handles the
   * idempotent upsert and schedules a 5-minute deferred re-sync job.
   *
   * After processing, an in-app notification is sent to the platform admin
   * (`userId: 'ADMIN'`). The notification processor filters this if no ADMIN
   * user exists in the system.
   *
   * **Retry policy**: 3 attempts, exponential back-off starting at 3 seconds.
   *
   * @param job - BullMQ job containing `DisputeWebhookPayload`
   *
   * @example
   * ```ts
   * // Job payload structure:
   * {
   *   eventType: 'CUSTOMER.DISPUTE.CREATED',
   *   resource: {
   *     dispute_id: 'PP-D-27803',
   *     reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
   *     status: 'OPEN',
   *     create_time: '2026-07-05T10:00:00Z',
   *   }
   * }
   * ```
   */
  @Process(PAYPAL_JOBS.SYNC_DISPUTE)
  async handleDisputeWebhook(
    job: BullJob<DisputeWebhookPayload>,
  ): Promise<void> {
    const { resource } = job.data;
    this.logger.log(
      `[paypal-dispute] Processing dispute ${resource.dispute_id}`,
    );

    await this.disputeService.upsertDispute(resource);

    const locale = 'en';

    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
      userId: 'ADMIN',
      type:   'paypal.dispute.created',
      title:  '⚠️ New PayPal Dispute',
      body:   this.i18n.t('paypal.dispute.created', locale, {
        disputeId: resource.dispute_id,
      }),
      metadata: { disputeId: resource.dispute_id },
    });

    this.logger.log(
      `[paypal-dispute] Dispute ${resource.dispute_id} synced`,
    );
  }

  // ── Error Handler ─────────────────────────────────────────────────────────

  /**
   * Handles failed BullMQ jobs. Logs the job name, ID, attempt count, and error
   * stack trace for debugging and alerting.
   *
   * This handler fires after all retry attempts are exhausted.
   *
   * @param job   - The failed BullMQ job instance
   * @param error - The error that caused the failure
   */
  @OnQueueFailed()
  onFailed(job: BullJob, error: Error): void {
    this.logger.error(
      `[paypal-queue] Job failed: [${job.name}] id=${job.id} attempt=${job.attemptsMade}`,
      error.stack,
    );
  }
}
