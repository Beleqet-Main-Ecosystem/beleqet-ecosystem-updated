import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { QueuesModule } from '../queues/queues.module';
import { ChatModule } from '../chat/chat.module';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';

@Module({
  imports: [QueuesModule, ChatModule, AuditTrailModule],
  controllers: [AdminController],
})
export class AdminModule {}
