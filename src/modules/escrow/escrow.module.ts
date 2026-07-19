import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { TwoFactorModule } from '../two-factor/two-factor.module';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';
import { EscrowProcessor } from './escrow.processor';
import { WalletModule } from '../wallet/wallet.module';
import { ChapaClient } from './chapa.client';
import { ChapaSignatureService } from './chapa-signature.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.ESCROW }, { name: QUEUE_NAMES.NOTIFICATIONS }),
    WalletModule,
    TwoFactorModule,
  ],
  providers: [EscrowService, EscrowProcessor, ChapaClient, ChapaSignatureService],
  controllers: [EscrowController],
  exports: [EscrowService, ChapaClient, ChapaSignatureService],
})
export class EscrowModule {}
