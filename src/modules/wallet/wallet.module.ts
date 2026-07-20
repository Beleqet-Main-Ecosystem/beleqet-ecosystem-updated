import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { TwoFactorModule } from '../two-factor/two-factor.module';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { WalletProcessor } from './wallet.processor';
import { ChapaModule } from '../chapa/chapa.module';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.WALLET }), TwoFactorModule, ChapaModule],
  providers: [WalletService, WalletProcessor],
  controllers: [WalletController],
  exports: [WalletService],
})
export class WalletModule {}
