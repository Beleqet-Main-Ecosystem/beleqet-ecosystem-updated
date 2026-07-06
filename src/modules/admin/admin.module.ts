import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { QueuesModule } from '../queues/queues.module';
import { ChatModule } from '../chat/chat.module';
import { FraudAlertModule } from '../fraud-alert/fraud-alert.module';

@Module({
  imports: [QueuesModule, ChatModule, FraudAlertModule],
  controllers: [AdminController],
})
export class AdminModule {}
