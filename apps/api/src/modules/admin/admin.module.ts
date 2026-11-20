import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { QueuesModule } from '../queues/queues.module';
import { ChatModule } from '../chat/chat.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { DisputeManagerModule } from '../dispute-manager/dispute-manager.module';
import { JobsModule } from '../jobs/jobs.module';

@Module({
  imports: [
    QueuesModule,
    ChatModule,
    NotificationsModule,
    AuditModule,
    DisputeManagerModule,
    JobsModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
