import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { TwoFactorModule } from '../two-factor/two-factor.module';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { WalletProcessor } from './wallet.processor';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.WALLET }), TwoFactorModule],
  providers: [WalletService, WalletProcessor],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
