import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { PaymentGatewayService } from './payment-gateway.service';
import { SubscriptionScheduler } from './subscription.scheduler';

@Module({
  imports: [
    // Scheduler uses the shared SCHEDULED queue (already registered globally via QueuesModule)
    BullModule.registerQueue({ name: QUEUE_NAMES.SCHEDULED }),
  ],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    PaymentGatewayService,
    SubscriptionScheduler,
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
