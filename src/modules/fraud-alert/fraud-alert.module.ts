import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { FraudAlertService } from './fraud-alert.service';
import { FraudAlertProcessor } from './fraud-alert.processor';
import { FraudAlertController } from './fraud-alert.controller';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.FRAUD }),
    QueuesModule,
  ],
  providers: [FraudAlertService, FraudAlertProcessor],
  controllers: [FraudAlertController],
  exports: [FraudAlertService],
})
export class FraudAlertModule {}
