import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { ScreeningProcessor } from './screening.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.APPLICATION },
      { name: QUEUE_NAMES.NOTIFICATIONS },
      { name: QUEUE_NAMES.ANALYTICS },
    ),
  ],
  providers: [ScreeningProcessor],
  exports: [ScreeningProcessor],
})
export class ScreeningModule {}
