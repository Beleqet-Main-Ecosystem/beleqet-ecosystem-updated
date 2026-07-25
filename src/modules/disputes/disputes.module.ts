import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }, { name: QUEUE_NAMES.ESCROW }),
  ],
  providers: [DisputesService],
  controllers: [DisputesController],
  exports: [DisputesService],
})
export class DisputesModule {}
