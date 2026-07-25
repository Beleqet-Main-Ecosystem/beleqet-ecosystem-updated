import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { QueuesModule } from '../queues/queues.module';
import { ChatModule } from '../chat/chat.module';
import { AuditLoggingModule } from '../audit-logging/audit-logging.module';

@Module({
  imports: [QueuesModule, ChatModule, AuditLoggingModule],
  controllers: [AdminController],
})
export class AdminModule {}
