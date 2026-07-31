import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { AiMatchmakerService } from './ai-matchmaker.service';
import { AiMatchmakerController } from './ai-matchmaker.controller';
import { AiMatchmakerProcessor } from './ai-matchmaker.processor';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.AI_MATCHMAKER,
    }),
  ],
  controllers: [AiMatchmakerController],
  providers: [AiMatchmakerService, AiMatchmakerProcessor],
  exports: [AiMatchmakerService],
})
export class AiMatchmakerModule {}
