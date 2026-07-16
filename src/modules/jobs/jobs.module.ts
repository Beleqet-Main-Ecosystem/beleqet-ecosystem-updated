import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq'; // Correct package path
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { QUEUE_NAMES } from '../queues/queues.constants';

@Module({
  imports: [
    ConfigModule,
    // Formally register the notifications queue so JobsService can inject it
    BullModule.registerQueue({ name: QUEUE_NAMES.NOTIFICATIONS }),
  ],
  providers: [JobsService],
  controllers: [JobsController],
  exports: [JobsService],
})
export class JobsModule {}