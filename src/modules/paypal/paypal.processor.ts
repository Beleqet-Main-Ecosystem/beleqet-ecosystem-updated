import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job as BullJob } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, PAYPAL_JOBS, NOTIFICATION_JOBS } from '../queues/queues.constants';
import { PaypalDisputeService } from './paypal-dispute.service';

// ── Payload type definitions ───────────────────────────────────────────────────

interface CaptureWebhookPayload {
  eventType: string;
  resource: {
    id: string;           // Capture ID
    status: string;
    amount?: { value: string; currency_code: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
    [key: string]: unknown;
  };
}

interface SubscriptionWebhookPayload {
  eventType: string;
  resource: {
    id: string;           // Subscription ID
    status: string;
    billing_info?: { next_billing_time?: string };
    start_time?: string;
    [key: string]: unknown;
  };
}

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
 * BullMQ processor for all PayPal queue jobs.
 *
 * Mirrors the `EscrowProcessor` pattern exactly — uses `@Processor` +
 * `@Process` decorators and handles three job types:
 * 1. `PROCESS_WEBHOOK`   — captures & capture-denied events
 * 2. `SYNC_SUBSCRIPTION` — subscription lifecycle events
 * 3. `SYNC_DISPUTE`      — dispute create / resolve events
 */
@Injectable()
@Processor(QUEUE_NAMES.PAYPAL)
export class PaypalProcessor {
  private readonly logger = new Logger(PaypalProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly disputeService: PaypalDisputeService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
  ) {}

  // ── 1. Capture webhook (PAYMENT.CAPTURE.*) ──────────────────────────────────

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
          eventType:  `paypal.${eventType.toLowerCase()}`,
          entityId:   tx.id,
          entityType: 'PaypalTransaction',
          payload:    { captureId, status: newStatus },
          processedBy: PaypalProcessor.name,
        },
      }),
    ]);

    // Notify client
    const notifTitle =
      newStatus === 'CAPTURED'
        ? '✅ Payment confirmed via PayPal'
        : '❌ PayPal payment failed';
    const notifBody =
      newStatus === 'CAPTURED'
        ? `${tx.currency} ${Number(tx.amount).toFixed(2)} has been successfully charged.`
        : 'Your PayPal payment could not be processed. Please try again.';

    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
      userId: tx.clientId,
      type:   `paypal.${newStatus.toLowerCase()}`,
      title:  notifTitle,
      body:   notifBody,
      metadata: { transactionId: tx.id, captureId },
    });

    this.logger.log(
      `[paypal-webhook] Transaction ${tx.id} updated to ${newStatus}`,
    );
  }

  // ── 2. Subscription events (BILLING.SUBSCRIPTION.*) ────────────────────────

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
        status: newStatus,
        nextBillingTime: nextBillingTime ?? undefined,
        cancelledAt:  newStatus === 'CANCELLED' ? new Date() : undefined,
        suspendedAt:  newStatus === 'SUSPENDED'  ? new Date() : undefined,
        startTime:    newStatus === 'ACTIVE' && !record.startTime ? new Date() : undefined,
        gatewayResponse: resource as object,
      },
    });

    // Notify the subscriber
    const titles: Record<string, string> = {
      ACTIVE:    '✅ Subscription activated',
      CANCELLED: '🚫 Subscription cancelled',
      SUSPENDED: '⏸ Subscription suspended',
      EXPIRED:   '⌛ Subscription expired',
    };

    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
      userId: record.userId,
      type:   `paypal.subscription.${newStatus.toLowerCase()}`,
      title:  titles[newStatus] ?? 'Subscription updated',
      body:   `Your Beleqet subscription status is now: ${newStatus}.`,
      metadata: { subscriptionId: paypalSubscriptionId, status: newStatus },
    });

    this.logger.log(
      `[paypal-sub] Subscription ${paypalSubscriptionId} → ${newStatus}`,
    );
  }

  // ── 3. Dispute events (CUSTOMER.DISPUTE.*) ─────────────────────────────────

  @Process(PAYPAL_JOBS.SYNC_DISPUTE)
  async handleDisputeWebhook(
    job: BullJob<DisputeWebhookPayload>,
  ): Promise<void> {
    const { resource } = job.data;
    this.logger.log(
      `[paypal-dispute] Processing dispute ${resource.dispute_id}`,
    );

    await this.disputeService.upsertDispute(resource);

    // Attempt to notify platform admin (via notifications queue)
    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
      userId: 'ADMIN', // Will be filtered in notification processor if ADMIN doesn't exist
      type:   'paypal.dispute.created',
      title:  '⚠️ New PayPal Dispute',
      body:   `Dispute ${resource.dispute_id} opened — reason: ${resource.reason}`,
      metadata: { disputeId: resource.dispute_id },
    });

    this.logger.log(
      `[paypal-dispute] Dispute ${resource.dispute_id} synced`,
    );
  }

  // ── Error Handler ─────────────────────────────────────────────────────────

  @OnQueueFailed()
  onFailed(job: BullJob, error: Error): void {
    this.logger.error(
      `[paypal-queue] Job failed: [${job.name}] id=${job.id} attempt=${job.attemptsMade}`,
      error.stack,
    );
  }
}
