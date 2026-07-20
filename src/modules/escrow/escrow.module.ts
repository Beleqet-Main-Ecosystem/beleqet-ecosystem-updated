import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { TwoFactorModule } from '../two-factor/two-factor.module';
import { EscrowService } from './escrow.service';
import { EscrowController } from './escrow.controller';
import { EscrowProcessor } from './escrow.processor';
import { WalletModule } from '../wallet/wallet.module';
import { ChapaSignatureService } from './chapa-signature.service';
import { ChapaModule } from '../chapa/chapa.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.ESCROW }, { name: QUEUE_NAMES.NOTIFICATIONS }),
    WalletModule,
    TwoFactorModule,
    ChapaModule,
  ],
  providers: [EscrowService, EscrowProcessor, ChapaSignatureService],
  controllers: [EscrowController],
  exports: [EscrowService, ChapaSignatureService],
})
export class EscrowModule {}
