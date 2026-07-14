import { Module } from '@nestjs/common';
import { PaymentGatewayController } from './payment-gateway.controller';
import { PaymentGatewayService } from './payment-gateway.service';

/**
 * Global Payment Gateway module.
 * Integrates Stripe and PayPal with multi-currency support.
 * Includes GDPR-compliant data export and deletion endpoints.
 */
@Module({
  controllers: [PaymentGatewayController],
  providers: [PaymentGatewayService],
  exports: [PaymentGatewayService],
})
export class PaymentGatewayModule {}
