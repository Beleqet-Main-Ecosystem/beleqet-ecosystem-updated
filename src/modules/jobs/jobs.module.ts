import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JobsService } from './jobs.service';
import { JobsController } from './jobs.controller';
import { QueuesModule } from '../queues/queues.module';
import { RedisCacheModule } from '../cache/redis-cache.module';

@Module({
  imports: [ConfigModule, QueuesModule, RedisCacheModule],
  providers: [JobsService],
  controllers: [JobsController],
  exports: [JobsService],
})
export class JobsModule {}
