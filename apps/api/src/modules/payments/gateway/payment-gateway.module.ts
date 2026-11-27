import { Module } from '@nestjs/common';
import { BeleqetPayModule } from '../beleqet-pay/beleqet-pay.module';
import { ChapaModule } from '../chapa/chapa.module';
import { PaymentGateway } from './payment-gateway.service';

@Module({
  imports: [ChapaModule, BeleqetPayModule],
  providers: [PaymentGateway],
  exports: [PaymentGateway, ChapaModule],
})
export class PaymentGatewayModule {}
