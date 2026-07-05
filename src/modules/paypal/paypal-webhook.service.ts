import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import axios from 'axios';
import { Request } from 'express';
import { PaypalAuthService } from './paypal-auth.service';
import { QUEUE_NAMES, PAYPAL_JOBS } from '../queues/queues.constants';

/** Shape of the PayPal verification API response */
interface VerifyResponse {
  verification_status: 'SUCCESS' | 'FAILURE';
}

/**
 * Verifies and dispatches incoming PayPal webhook events.
 *
 * PayPal uses **asymmetric signature verification** (not HMAC).
 * The raw request body, transmission headers, and the configured
 * Webhook ID are sent back to PayPal's verify API. PayPal responds
 * with `SUCCESS` or `FAILURE`.
 *
 * Verified events are dispatched to the BullMQ `paypal` queue for
 * async processing — keeping the webhook endpoint response time < 200ms.
 */
@Injectable()
export class PaypalWebhookService {
  private readonly logger = new Logger(PaypalWebhookService.name);

  constructor(
    private readonly auth: PaypalAuthService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.PAYPAL)
    private readonly paypalQueue: Queue,
  ) {}

  /**
   * Verifies a PayPal webhook signature and enqueues the event for processing.
   *
   * The verification is performed by calling PayPal's
   * `/v1/notifications/verify-webhook-signature` endpoint, which uses
   * the cert URL embedded in the `paypal-cert-url` header to validate
   * the transmission signature — no local key management required.
   *
   * @param req  - Raw Express request (must have `rawBody` Buffer attached)
   * @param body - Parsed JSON webhook event body
   * @throws UnauthorizedException if the PayPal signature check fails
   */
  async verifyAndDispatch(
    req: Request & { rawBody?: Buffer },
    body: Record<string, unknown>,
  ): Promise<void> {
    await this.verifySignature(req, body);
    await this.dispatch(body);
  }

  /**
   * Calls PayPal's verify-webhook-signature API and throws if verification fails.
   *
   * In non-production environments a warning is logged instead of throwing,
   * so local development with ngrok can proceed without a matching cert.
   *
   * @param req  - Express request containing PayPal transmission headers
   * @param body - Parsed webhook payload
   * @throws UnauthorizedException in production when verification fails
   */
  async verifySignature(
    req: Request & { rawBody?: Buffer },
    body: Record<string, unknown>,
  ): Promise<void> {
    const webhookId = this.config.get<string>('PAYPAL_WEBHOOK_ID');
    const isProduction =
      this.config.get<string>('NODE_ENV') === 'production';

    // Extract PayPal transmission headers
    const transmissionId  = req.headers['paypal-transmission-id']  as string;
    const transmissionTime = req.headers['paypal-transmission-time'] as string;
    const certUrl         = req.headers['paypal-cert-url']          as string;
    const transmissionSig = req.headers['paypal-transmission-sig']  as string;
    const authAlgo        = req.headers['paypal-auth-algo']         as string;

    if (!transmissionId || !certUrl || !transmissionSig || !webhookId) {
      const msg = 'Missing required PayPal webhook verification headers or PAYPAL_WEBHOOK_ID';
      if (isProduction) {
        this.logger.error(msg);
        throw new UnauthorizedException(msg);
      } else {
        this.logger.warn(`[DEV] ${msg} — skipping verification`);
        return;
      }
    }

    const token   = await this.auth.getAccessToken();
    const baseUrl = this.auth.getBaseUrl();

    let verificationStatus: string;

    try {
      const response = await axios.post<VerifyResponse>(
        `${baseUrl}/v1/notifications/verify-webhook-signature`,
        {
          auth_algo:         authAlgo,
          cert_url:          certUrl,
          transmission_id:   transmissionId,
          transmission_sig:  transmissionSig,
          transmission_time: transmissionTime,
          webhook_id:        webhookId,
          webhook_event:     body,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      verificationStatus = response.data.verification_status;
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? JSON.stringify(err.response?.data)
        : String(err);
      this.logger.error(`PayPal webhook verification API call failed: ${msg}`);

      if (isProduction) {
        throw new UnauthorizedException('PayPal webhook signature verification failed');
      }
      this.logger.warn('[DEV] Verification API error — proceeding without verification');
      return;
    }

    if (verificationStatus !== 'SUCCESS') {
      this.logger.error(
        `PayPal webhook signature INVALID for event ${body['id'] ?? '?'} — status: ${verificationStatus}`,
      );
      if (isProduction) {
        throw new UnauthorizedException('Invalid PayPal webhook signature');
      }
      this.logger.warn('[DEV] Signature mismatch — proceeding in dev mode');
    } else {
      this.logger.debug(
        `PayPal webhook ${body['event_type'] ?? 'UNKNOWN'} verified ✓`,
      );
    }
  }

  /**
   * Routes a verified webhook event to the appropriate BullMQ job.
   *
   * Supported event types:
   * - `PAYMENT.CAPTURE.COMPLETED` / `PAYMENT.CAPTURE.DENIED`
   * - `BILLING.SUBSCRIPTION.*`
   * - `CUSTOMER.DISPUTE.CREATED` / `CUSTOMER.DISPUTE.RESOLVED`
   *
   * Unknown event types are logged and silently ignored.
   *
   * @param body - The verified PayPal webhook event body
   */
  private async dispatch(body: Record<string, unknown>): Promise<void> {
    const eventType = body['event_type'] as string | undefined;
    const resource  = body['resource']  as Record<string, unknown> | undefined;

    this.logger.log(`Dispatching PayPal webhook event: ${eventType}`);

    const jobOpts = {
      attempts: 3,
      backoff:  { type: 'exponential', delay: 3_000 },
      removeOnComplete: 100,
      removeOnFail:     200,
    };

    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED':
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.REFUNDED':
        await this.paypalQueue.add(
          PAYPAL_JOBS.PROCESS_WEBHOOK,
          { eventType, resource },
          jobOpts,
        );
        break;

      case 'BILLING.SUBSCRIPTION.ACTIVATED':
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await this.paypalQueue.add(
          PAYPAL_JOBS.SYNC_SUBSCRIPTION,
          { eventType, resource },
          jobOpts,
        );
        break;

      case 'CUSTOMER.DISPUTE.CREATED':
      case 'CUSTOMER.DISPUTE.RESOLVED':
      case 'CUSTOMER.DISPUTE.UPDATED':
        await this.paypalQueue.add(
          PAYPAL_JOBS.SYNC_DISPUTE,
          { eventType, resource },
          jobOpts,
        );
        break;

      default:
        this.logger.debug(`Unhandled PayPal event type: ${eventType} — ignoring`);
    }
  }
}
