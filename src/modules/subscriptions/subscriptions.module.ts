import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsCheckoutService } from './subscriptions-checkout.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PlanPaymentsService } from './plan-payments.service';
import { ChapaModule } from '../chapa/chapa.module';

@Module({
  // PaymentsModule is imported one-directionally here (checkout needs
  // PaypalService). PaymentsModule itself never imports SubscriptionsModule —
  // webhook -> subscription syncing flows through an EventEmitter2 event
  // instead (see paypal.service.ts + billing.service.ts), so there is no
  // circular module dependency.
  imports: [PrismaModule, PaymentsModule, ChapaModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, SubscriptionsCheckoutService, PlanPaymentsService],
  exports: [SubscriptionsService, PlanPaymentsService],
})
export class SubscriptionsModule {}
