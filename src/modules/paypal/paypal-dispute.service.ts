import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { PaypalAuthService } from './paypal-auth.service';
import { RefundDto } from './dto/refund.dto';
import { QUEUE_NAMES, PAYPAL_JOBS } from '../queues/queues.constants';

/**
 * Handles PayPal Refunds and Disputes.
 *
 * - **Refunds**: issues partial or full refunds against a captured payment
 *   via the PayPal Captures API and updates the local transaction record.
 * - **Disputes**: receives dispute data from PayPal webhooks (via the queue
 *   processor) and upserts a `PaypalDispute` record. Provides a helper to
 *   sync the latest dispute state on demand.
 */
@Injectable()
export class PaypalDisputeService {
  private readonly logger = new Logger(PaypalDisputeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: PaypalAuthService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.PAYPAL)
    private readonly paypalQueue: Queue,
  ) {}

  /**
   * Issues a partial or full refund on a captured PayPal payment.
   * If `dto.amount` is omitted the entire capture amount is refunded.
   *
   * @param captureId - PayPal Capture ID to refund
   * @param clientId  - Authenticated user who owns the transaction (safety check)
   * @param dto       - Optional partial amount, currency, and internal note
   * @returns Refund result including PayPal refund ID and new local status
   * @throws NotFoundException   if no local transaction matches the capture ID
   * @throws BadRequestException if PayPal rejects the refund
   */
  async refund(captureId: string, clientId: string, dto: RefundDto) {
    // Load the local transaction for the ownership check
    const tx = await this.prisma.paypalTransaction.findFirst({
      where: { paypalCaptureId: captureId, clientId },
    });
    if (!tx) {
      throw new NotFoundException(
        `No captured transaction found for captureId ${captureId} belonging to client ${clientId}`,
      );
    }

    const token   = await this.auth.getAccessToken();
    const baseUrl = this.auth.getBaseUrl();

    const body: Record<string, unknown> = {};
    if (dto.amount !== undefined) {
      body.amount = {
        value:         dto.amount.toFixed(2),
        currency_code: dto.currency ?? tx.currency,
      };
    }
    if (dto.note) {
      body.note_to_payer = dto.note.substring(0, 255);
    }

    let refundId: string;
    let refundStatus: string;
    let rawResponse: unknown;

    try {
      const response = await axios.post<{ id: string; status: string }>(
        `${baseUrl}/v2/payments/captures/${captureId}/refund`,
        body,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      rawResponse   = response.data;
      refundId      = response.data.id;
      refundStatus  = response.data.status;
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? JSON.stringify(err.response?.data)
        : String(err);
      this.logger.error(`Refund failed for captureId ${captureId}: ${msg}`);
      throw new BadRequestException(`PayPal refund failed: ${msg}`);
    }

    // Determine whether it was full or partial
    const isPartial = dto.amount !== undefined;
    const newStatus = isPartial ? 'PARTIALLY_REFUNDED' : 'REFUNDED';

    const updated = await this.prisma.paypalTransaction.update({
      where: { id: tx.id },
      data: {
        status:          newStatus,
        refundedAmount:  dto.amount ?? tx.amount,
        refundNote:      dto.note ?? null,
        gatewayResponse: rawResponse as object,
      },
    });

    this.logger.log(
      `Refund ${refundId} (${refundStatus}) issued for capture ${captureId} — ${newStatus}`,
    );

    return {
      transactionId: updated.id,
      captureId,
      refundId,
      refundStatus,
      newTxStatus: newStatus,
      refundedAmount: dto.amount ?? Number(tx.amount),
    };
  }

  /**
   * Upserts a `PaypalDispute` record from incoming webhook data or a
   * manual sync call. Safe to call multiple times for the same dispute
   * (idempotent on `paypalDisputeId`).
   *
   * @param payload - Raw PayPal dispute resource from a webhook or API call
   * @returns The created or updated local dispute record
   */
  async upsertDispute(payload: {
    dispute_id: string;
    reason: string;
    status: string;
    dispute_outcome?: { outcome_code?: string };
    create_time: string;
    update_time?: string;
    dispute_transactions?: { buyer_transaction_id?: string }[];
    [key: string]: unknown;
  }) {
    const paypalDisputeId = payload.dispute_id;

    // Try to link to a local transaction via PayPal's buyer_transaction_id
    let transactionId: string | null = null;
    const buyerTxId =
      payload.dispute_transactions?.[0]?.buyer_transaction_id;
    if (buyerTxId) {
      const localTx = await this.prisma.paypalTransaction.findFirst({
        where: { paypalCaptureId: buyerTxId },
      });
      transactionId = localTx?.id ?? null;
    }

    const disputeStatus = this.mapDisputeStatus(payload.status);

    const record = await this.prisma.paypalDispute.upsert({
      where:  { paypalDisputeId },
      update: {
        status:          disputeStatus,
        outcome:         payload.dispute_outcome?.outcome_code ?? null,
        resolvedAt:      payload.update_time ? new Date(payload.update_time) : null,
        gatewayResponse: payload as object,
      },
      create: {
        paypalDisputeId,
        transactionId,
        reason:      payload.reason ?? 'UNKNOWN',
        status:      disputeStatus,
        openedAt:    new Date(payload.create_time),
        resolvedAt:  payload.update_time ? new Date(payload.update_time) : null,
        outcome:     payload.dispute_outcome?.outcome_code ?? null,
        gatewayResponse: payload as object,
      },
    });

    this.logger.log(
      `Dispute ${paypalDisputeId} upserted — status: ${disputeStatus}`,
    );

    // Enqueue a deferred sync to refresh state from PayPal API (5 min delay)
    await this.paypalQueue.add(
      PAYPAL_JOBS.SYNC_DISPUTE,
      { disputeId: paypalDisputeId, localId: record.id },
      { delay: 5 * 60 * 1_000, attempts: 3, backoff: { type: 'exponential', delay: 10_000 } },
    );

    return record;
  }

  /**
   * Maps a PayPal dispute status string to the local `PaypalDisputeStatus` enum value.
   *
   * @param paypalStatus - Raw PayPal dispute status string
   * @returns Matching enum key or `'OPEN'` as fallback
   */
  private mapDisputeStatus(
    paypalStatus: string,
  ):
    | 'OPEN'
    | 'WAITING_FOR_BUYER_RESPONSE'
    | 'WAITING_FOR_SELLER_RESPONSE'
    | 'UNDER_REVIEW'
    | 'RESOLVED'
    | 'CANCELLED' {
    const map: Record<string, 'OPEN' | 'WAITING_FOR_BUYER_RESPONSE' | 'WAITING_FOR_SELLER_RESPONSE' | 'UNDER_REVIEW' | 'RESOLVED' | 'CANCELLED'> = {
      OPEN:                        'OPEN',
      WAITING_FOR_BUYER_RESPONSE:  'WAITING_FOR_BUYER_RESPONSE',
      WAITING_FOR_SELLER_RESPONSE: 'WAITING_FOR_SELLER_RESPONSE',
      UNDER_REVIEW:                'UNDER_REVIEW',
      RESOLVED:                    'RESOLVED',
      CANCELLED:                   'CANCELLED',
    };
    return map[paypalStatus] ?? 'OPEN';
  }
}
