import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { PaypalController } from './paypal.controller';
import { PaypalAuthService } from './paypal-auth.service';
import { PaypalOrderService } from './paypal-order.service';
import { PaypalSubscriptionService } from './paypal-subscription.service';
import { PaypalWebhookService } from './paypal-webhook.service';
import { PaypalDisputeService } from './paypal-dispute.service';
import { PaypalProcessor } from './paypal.processor';

/**
 * PayPal Global Digital Wallet Module (Global-Payments-002).
 *
 * Registers:
 * - BullMQ queues: `paypal` (primary) and `notifications` (for user alerts)
 * - All PayPal services (auth, order, subscription, webhook, dispute)
 * - The BullMQ processor for async event handling
 * - The HTTP controller exposing all PayPal-facing endpoints
 */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.PAYPAL },
      { name: QUEUE_NAMES.NOTIFICATIONS },
    ),
  ],
  providers: [
    PaypalAuthService,
    PaypalOrderService,
    PaypalSubscriptionService,
    PaypalWebhookService,
    PaypalDisputeService,
    PaypalProcessor,
  ],
  controllers: [PaypalController],
  exports: [
    PaypalAuthService,
    PaypalOrderService,
    PaypalSubscriptionService,
    PaypalDisputeService,
  ],
})
export class PaypalModule {}
