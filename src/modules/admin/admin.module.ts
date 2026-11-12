import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { QueuesModule } from '../queues/queues.module';
import { ChatModule } from '../chat/chat.module';
import { FraudAlertModule } from '../fraud-alert/fraud-alert.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLoggingModule } from '../audit-logging/audit-logging.module';
import { DisputeManagerModule } from '../dispute-manager/dispute-manager.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [
    QueuesModule,
    ChatModule,
    FraudAlertModule,
    NotificationsModule,
    AuditLoggingModule,
    DisputeManagerModule,
    JobsModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
