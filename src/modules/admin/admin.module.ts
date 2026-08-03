import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { QueuesModule } from '../queues/queues.module';
import { ChatModule } from '../chat/chat.module';
import { FraudAlertModule } from '../fraud-alert/fraud-alert.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [QueuesModule, ChatModule, FraudAlertModule, NotificationsModule],
  controllers: [AdminController],
})
export class AdminModule {}
