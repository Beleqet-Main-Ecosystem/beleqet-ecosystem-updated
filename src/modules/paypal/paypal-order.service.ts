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

/** Platform fee percentage applied to all PayPal transactions */
const PLATFORM_FEE_PCT = 0.05; // 5%

/**
 * Handles the PayPal Orders API lifecycle:
 * 1. Create an order (returns `approveUrl` for buyer redirect)
 * 2. Capture an approved order (finalises the charge)
 *
 * All orders are persisted in `paypal_transactions` with full idempotency
 * support to prevent duplicate charges on retries.
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
   * Creates a PayPal Order and stores a `CREATED` transaction record.
   *
   * @param clientId   - The authenticated user initiating the payment
   * @param dto        - Order creation payload (amount, currency, associations)
   * @returns `{ orderId, approveUrl, transactionId }` — redirect user to `approveUrl`
   * @throws ConflictException   if the idempotency key has already been used
   * @throws BadRequestException if PayPal rejects the order creation
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

    const platformFee = +(dto.amount * PLATFORM_FEE_PCT).toFixed(2);

    let paypalOrderId: string;
    let approveUrl: string;

    const mode = this.config.get<string>('PAYPAL_MODE', 'sandbox');

    if (mode === 'mock') {
      paypalOrderId = `MOCK-ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
      approveUrl = `${frontendUrl}/paypal-mock-checkout?orderId=${paypalOrderId}&amount=${dto.amount}&currency=${dto.currency}&type=order`;
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
              return_url: returnUrl,
              cancel_url: cancelUrl,
              brand_name: 'Beleqet',
              user_action: 'PAY_NOW',
              shipping_preference: 'NO_SHIPPING',
            },
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'PayPal-Request-Id': idempotencyKey,
            },
          },
        );

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

    // Persist the transaction record
    const tx = await this.prisma.paypalTransaction.create({
      data: {
        paypalOrderId,
        status: 'CREATED',
        amount: dto.amount,
        currency: dto.currency,
        platformFee,
        idempotencyKey,
        clientId,
        freelancerId:  dto.freelancerId  ?? null,
        freelanceJobId: dto.freelanceJobId ?? null,
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
   * Captures an approved PayPal order, finalising the charge.
   * Updates the stored transaction to `CAPTURED` with the capture ID.
   *
   * @param clientId - The authenticated user who owns this order
   * @param orderId  - PayPal Order ID to capture
   * @returns Capture result with capture ID and updated status
   * @throws NotFoundException   if no local transaction matches the order ID
   * @throws BadRequestException if the capture is rejected by PayPal
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
      captureId = `MOCK-CAP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      captureStatus = 'COMPLETED';
      rawResponse = { status: 'COMPLETED', simulated: true };
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
              Authorization: `Bearer ${token}`,
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

    const updated = await this.prisma.paypalTransaction.update({
      where: { id: tx.id },
      data: {
        paypalCaptureId: captureId || null,
        status:          newStatus,
        gatewayResponse: rawResponse as object,
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
