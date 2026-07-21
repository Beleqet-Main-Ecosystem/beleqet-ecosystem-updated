import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { PaymentGatewayService } from './payment-gateway.service';
import { SubscriptionScheduler } from './subscription.scheduler';

@Module({
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    PaymentGatewayService,
    SubscriptionScheduler,
  ],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
