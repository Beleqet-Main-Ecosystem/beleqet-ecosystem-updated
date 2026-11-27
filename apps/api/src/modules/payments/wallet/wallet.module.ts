import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../../platform/queues/queues.constants';
import { TwoFactorModule } from '../../accounts/two-factor/two-factor.module';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { WalletProcessor } from './wallet.processor';
import { PaymentGatewayModule } from '../gateway/payment-gateway.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.WALLET }, { name: QUEUE_NAMES.NOTIFICATIONS }),
    TwoFactorModule,
    PaymentGatewayModule,
  ],
  providers: [WalletService, WalletProcessor],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
