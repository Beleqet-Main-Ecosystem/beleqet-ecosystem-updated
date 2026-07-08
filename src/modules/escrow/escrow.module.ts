import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { TwoFactorModule } from '../two-factor/two-factor.module';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';
import { EscrowProcessor } from './escrow.processor';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.ESCROW },
      { name: QUEUE_NAMES.NOTIFICATIONS },
    ),
    WalletModule,
    TwoFactorModule,
  ],
  providers: [EscrowService, EscrowProcessor],
  controllers: [EscrowController],
  exports: [EscrowService],
})
export class EscrowModule {}
