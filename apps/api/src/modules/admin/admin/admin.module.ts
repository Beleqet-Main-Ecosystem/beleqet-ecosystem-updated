import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { QueuesModule } from '../../platform/queues/queues.module';
import { ChatModule } from '../../messaging/chat/chat.module';
import { NotificationsModule } from '../../messaging/notifications/notifications.module';
import { AuditModule } from '../../platform/audit/audit.module';
import { DisputeManagerModule } from '../../freelance/dispute-manager/dispute-manager.module';
import { JobsModule } from '../../jobs/jobs/jobs.module';

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
