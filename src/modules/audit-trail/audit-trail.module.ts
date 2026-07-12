import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { AuditService } from './audit.service';
import { AuditConsumer } from './audit.consumer';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { GdprRedactionService } from './gdpr-redaction.service';
import { RetentionTask } from './tasks/retention.task';
import { IpRedactionTask } from './tasks/ip-redaction.task';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.AUDIT_TRAIL }),
    ScheduleModule.forRoot(),
    PrismaModule,
  ],
  providers: [
    AuditService,
    AuditConsumer,
    GdprRedactionService,
    RetentionTask,
    IpRedactionTask,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  controllers: [AuditController],
  exports: [AuditService, GdprRedactionService],
})
export class AuditTrailModule {}
