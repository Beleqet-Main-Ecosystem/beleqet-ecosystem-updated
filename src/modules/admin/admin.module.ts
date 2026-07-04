import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { QueuesModule } from '../queues/queues.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [QueuesModule, ChatModule],
  controllers: [AdminController],
})
export class AdminModule {}
