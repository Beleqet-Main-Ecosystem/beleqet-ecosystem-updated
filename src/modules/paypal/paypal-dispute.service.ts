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
import { sanitiseForStorage } from './paypal-pii.utils';

/**
 * @class PaypalDisputeService
 * @module PayPal
 * @description Handles PayPal Refunds and Dispute lifecycle management.
 *
 * **Refunds**:
 * - Issues partial or full refunds via the PayPal `/v2/payments/captures/{id}/refund` endpoint.
 * - Each refund event is recorded as an **immutable** `PaypalRefund` row in the database,
 *   providing a per-event audit trail for compliance and reconciliation.
 * - The parent `PaypalTransaction` status is updated to `REFUNDED` or `PARTIALLY_REFUNDED`.
 *
 * **Disputes**:
 * - Receives dispute payloads from PayPal webhooks (via BullMQ) and upserts a `PaypalDispute` record.
 * - A 5-minute deferred sync job is enqueued after every upsert to re-fetch the latest state.
 * - Disputes are matched to a local transaction via `buyer_transaction_id`.
 *
 * **GDPR**: Raw PayPal API responses stored in `gatewayResponse` columns are passed through
 * `sanitiseForStorage()` before persistence — buyer email pseudonymised, addresses redacted.
 *
 * @see {@link https://developer.paypal.com/docs/api/payments/v2/#captures_refund} PayPal Refund API
 * @see {@link https://developer.paypal.com/docs/api/customer-disputes/v1/} PayPal Disputes API
 *
 * @example
 * ```ts
 * // Full refund:
 * await disputeSvc.refund('CAPTURE-ID-123', 'client-uuid', {});
 *
 * // Partial refund of $50 USD:
 * await disputeSvc.refund('CAPTURE-ID-123', 'client-uuid', {
 *   amount: 50.00,
 *   currency: 'USD',
 *   note: 'Partial delivery — agreed partial refund',
 * });
 * ```
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
   *
   * If `dto.amount` is omitted, the entire captured amount is refunded (full refund).
   * If `dto.amount` is provided, only that amount is refunded (partial refund).
   *
   * **Audit trail**: Each call creates an immutable `PaypalRefund` row in addition to
   * updating the parent `PaypalTransaction` status. This supports multiple partial
   * refund events on the same capture without data loss.
   *
   * **Ownership check**: The `clientId` must match the transaction's `clientId`.
   * This prevents users from refunding each other's payments.
   *
   * **GDPR**: The refund API response stored in `gatewayResponse` is pseudonymised
   * via `sanitiseForStorage()` before persistence.
   *
   * @param captureId - PayPal Capture ID to refund (e.g. `'3C679366HH908993F'`)
   * @param clientId  - UUID of the authenticated user who initiated the capture
   * @param dto       - Optional partial amount, currency code, and internal note
   * @returns Object containing `{ transactionId, captureId, refundId, refundStatus, newTxStatus, refundedAmount }`
   * @throws {NotFoundException}   If no captured transaction matches `captureId` for this client
   * @throws {BadRequestException} If PayPal rejects the refund request
   *
   * @example
   * ```ts
   * // Full refund:
   * const result = await disputeSvc.refund('3C679366HH908993F', 'client-uuid', {});
   * // result.newTxStatus → 'REFUNDED'
   *
   * // Partial refund:
   * const partial = await disputeSvc.refund('3C679366HH908993F', 'client-uuid', {
   *   amount: 25.00,
   *   currency: 'USD',
   *   note: 'Service delivered late — partial refund agreed',
   * });
   * // partial.newTxStatus → 'PARTIALLY_REFUNDED'
   * ```
   */
  async refund(captureId: string, clientId: string, dto: RefundDto) {
    // Ownership check — ensure the caller owns this transaction
    const tx = await this.prisma.paypalTransaction.findFirst({
      where: { paypalCaptureId: captureId, clientId },
    });
    if (!tx) {
      throw new NotFoundException(
        `No captured transaction found for captureId ${captureId} belonging to client ${clientId}`,
      );
    }

    const mode = this.config.get<string>('PAYPAL_MODE', 'sandbox');

    let refundId: string;
    let refundStatus: string;
    let rawResponse: unknown;

    if (mode === 'mock') {
      refundId     = `MOCK-REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      refundStatus = 'COMPLETED';
      rawResponse  = { status: 'COMPLETED', simulated: true };
    } else {
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

      try {
        const response = await axios.post<{ id: string; status: string }>(
          `${baseUrl}/v2/payments/captures/${captureId}/refund`,
          body,
          {
            headers: {
              Authorization:  `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        );
        rawResponse  = response.data;
        refundId     = response.data.id;
        refundStatus = response.data.status;
      } catch (err) {
        const msg = axios.isAxiosError(err)
          ? JSON.stringify(err.response?.data)
          : String(err);
        this.logger.error(`Refund failed for captureId ${captureId}: ${msg}`);
        throw new BadRequestException(`PayPal refund failed: ${msg}`);
      }
    }

    // Determine whether it was full or partial
    const isPartial = dto.amount !== undefined;
    const newStatus = isPartial ? 'PARTIALLY_REFUNDED' : 'REFUNDED';

    // Persist immutable refund audit record AND update parent transaction status atomically
    await this.prisma.$transaction([
      this.prisma.paypalTransaction.update({
        where: { id: tx.id },
        data: {
          status:          newStatus,
          refundedAmount:  dto.amount ?? tx.amount,
          refundNote:      dto.note ?? null,
          gatewayResponse: sanitiseForStorage(rawResponse),
        },
      }),
      this.prisma.paypalRefund.create({
        data: {
          paypalRefundId:  refundId,
          transactionId:   tx.id,
          amount:          dto.amount ?? Number(tx.amount),
          currency:        dto.currency ?? tx.currency,
          refundStatus,
          note:            dto.note ?? null,
          initiatedBy:     clientId,
          isPartial,
          gatewayResponse: sanitiseForStorage(rawResponse),
        },
      }),
    ]);

    this.logger.log(
      `Refund ${refundId} (${refundStatus}) issued for capture ${captureId} — ${newStatus}`,
    );

    return {
      transactionId:  tx.id,
      captureId,
      refundId,
      refundStatus,
      newTxStatus:    newStatus,
      refundedAmount: dto.amount ?? Number(tx.amount),
    };
  }

  /**
   * Upserts a `PaypalDispute` record from incoming webhook data or a manual sync call.
   *
   * This method is **idempotent** on `paypalDisputeId` — calling it multiple times
   * with the same dispute ID will update the existing record rather than creating duplicates.
   *
   * After upserting, a 5-minute deferred sync job is enqueued in the `paypal` queue
   * to re-fetch the latest dispute state from the PayPal API and apply any changes
   * that arrived in the interim.
   *
   * The dispute is linked to a local `PaypalTransaction` via the `buyer_transaction_id`
   * field in `dispute_transactions`, if available.
   *
   * **GDPR**: The raw PayPal dispute payload stored in `gatewayResponse` is pseudonymised
   * via `sanitiseForStorage()` before persistence.
   *
   * @param payload - Raw PayPal dispute resource object from a webhook or direct API call
   * @returns The created or updated local `PaypalDispute` Prisma record
   *
   * @example
   * ```ts
   * // Called from PaypalProcessor.handleDisputeWebhook():
   * await disputeSvc.upsertDispute({
   *   dispute_id: 'PP-D-27803',
   *   reason: 'MERCHANDISE_OR_SERVICE_NOT_RECEIVED',
   *   status: 'OPEN',
   *   create_time: '2026-07-05T10:00:00Z',
   *   dispute_transactions: [{ buyer_transaction_id: 'MOCK-CAP-123' }],
   * });
   * ```
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
        gatewayResponse: sanitiseForStorage(payload),
      },
      create: {
        paypalDisputeId,
        transactionId,
        reason:      payload.reason ?? 'UNKNOWN',
        status:      disputeStatus,
        openedAt:    new Date(payload.create_time),
        resolvedAt:  payload.update_time ? new Date(payload.update_time) : null,
        outcome:     payload.dispute_outcome?.outcome_code ?? null,
        gatewayResponse: sanitiseForStorage(payload),
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
   * Maps a raw PayPal dispute status string to the local `PaypalDisputeStatus` enum value.
   *
   * Any unrecognised status string falls back to `'OPEN'` to ensure the record
   * is always persisted with a valid enum value.
   *
   * @param paypalStatus - Raw string from PayPal dispute API (e.g. `'UNDER_REVIEW'`)
   * @returns Matching `PaypalDisputeStatus` enum key, or `'OPEN'` as fallback
   *
   * @example
   * ```ts
   * this.mapDisputeStatus('RESOLVED');          // → 'RESOLVED'
   * this.mapDisputeStatus('UNDER_REVIEW');       // → 'UNDER_REVIEW'
   * this.mapDisputeStatus('UNKNOWN_STATUS_XYZ'); // → 'OPEN' (fallback)
   * ```
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
