import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { QueuesModule } from '../queues/queues.module';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';

@Module({
  imports: [ConfigModule, QueuesModule, AuditTrailModule],
  providers: [JobsService],
  controllers: [JobsController],
  exports: [JobsService],
})
export class JobsModule {}
