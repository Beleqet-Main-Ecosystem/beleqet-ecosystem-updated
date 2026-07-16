import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq'; // Clean import path, correct class name
import { QUEUE_NAMES } from '../queues/queues.constants';
import { AnalyticsProcessor } from './analytics.processor';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.ANALYTICS })],
  providers: [AnalyticsProcessor],
})
export class AnalyticsModule {}