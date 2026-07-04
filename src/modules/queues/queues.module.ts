import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from './queues.constants';

const queues = Object.values(QUEUE_NAMES).map((name) =>
  BullModule.registerQueue({ name }),
);

@Module({
  imports: queues,
  exports: queues,
})
export class QueuesModule {}
