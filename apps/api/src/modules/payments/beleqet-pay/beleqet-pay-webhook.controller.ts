import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Queue } from 'bullmq';
import { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { ESCROW_JOBS, QUEUE_NAMES, WALLET_JOBS } from '../../platform/queues/queues.constants';
import { BeleqetPayWebhookEvent } from './beleqet-pay.types';
import { verifyBeleqetPayWebhook } from './webhook-signature';

/** Retries for the work an event starts, should Pay or the database be briefly unavailable. */
const JOB_OPTIONS = { attempts: 5, backoff: { type: 'exponential', delay: 10_000 } };

/**
 * Beleqet Pay's webhook: payments ending (success, failed, expired) and payouts ending (succeeded,
 * failed). Only signed events count (BELEQET_PAY_WEBHOOK_SECRET), each is handled once by its id,
 * and the answer comes at once: the work is queued, and it asks Pay again before anything changes.
 * Refund and dispute events are acknowledged; Jobs makes neither.
 */
@ApiExcludeController()
@Controller('beleqet-pay')
export class BeleqetPayWebhookController {
  private readonly logger = new Logger(BeleqetPayWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.ESCROW) private readonly escrowQueue: Queue,
    @InjectQueue(QUEUE_NAMES.WALLET) private readonly walletQueue: Queue,
  ) {}

  @SkipThrottle()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('x-beleqet-signature') signature?: string,
  ) {
    const secret = this.config.get<string>('BELEQET_PAY_WEBHOOK_SECRET')?.trim() ?? '';
    const event = req.rawBody ? verifyBeleqetPayWebhook(req.rawBody, signature, secret) : null;
    if (!event) throw new BadRequestException('Invalid webhook signature');

    const seen = await this.prisma.eventLog.findFirst({
      where: { eventType: 'beleqet_pay.webhook', entityId: event.id },
    });
    if (seen) return { received: true };

    await this.route(event);
    await this.prisma.eventLog.create({
      data: {
        eventType: 'beleqet_pay.webhook',
        entityId: event.id,
        entityType: 'BeleqetPayEvent',
        payload: {
          event: event.event,
          txRef: event.data.txRef ?? null,
          reference: event.data.reference ?? null,
          status: event.data.status ?? null,
        },
        processedBy: BeleqetPayWebhookController.name,
      },
    });
    return { received: true };
  }

  private async route(event: BeleqetPayWebhookEvent) {
    const { data } = event;
    if (event.event.startsWith('payment.') && data.txRef) {
      // Into the same queue as Chapa's events: it finds the escrow or plan payment and asks Pay.
      const metadata = data.metadata ?? {};
      const record = metadata.escrowId ?? metadata.planPaymentId;
      await this.escrowQueue.add(
        ESCROW_JOBS.PROCESS_WEBHOOK,
        {
          tx_ref: data.txRef,
          reference: data.txRef,
          externalRef: typeof record === 'string' ? record : undefined,
          event: event.event,
          status:
            event.event === 'payment.success'
              ? 'success'
              : event.event === 'payment.expired'
                ? 'expired'
                : 'failed',
          source: 'beleqet_pay',
        },
        { ...JOB_OPTIONS, jobId: `beleqet-pay-${event.id}` },
      );
      return;
    }
    if (event.event.startsWith('transfer.') && data.reference) {
      await this.walletQueue.add(
        WALLET_JOBS.PAYOUT_RESULT,
        { reference: data.reference },
        { ...JOB_OPTIONS, jobId: `beleqet-pay-${event.id}` },
      );
      return;
    }
    this.logger.log(`Beleqet Pay event ${event.event} (${event.id}) acknowledged`);
  }
}
