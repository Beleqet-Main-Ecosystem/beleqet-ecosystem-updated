/**
 * @file db-index-master.module.ts
 * @description
 * NestJS module for DB Index Master — strategic PostgreSQL index management
 * and query performance analysis.
 *
 * Exports DbIndexMasterService so other modules (e.g. AdminModule) can inject
 * it for programmatic health checks.
 */
import { Module } from '@nestjs/common';
import { DbIndexMasterController } from './db-index-master.controller';
import { DbIndexMasterService } from './db-index-master.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DbIndexMasterController],
  providers: [DbIndexMasterService],
  exports: [DbIndexMasterService],
})
export class DbIndexMasterModule {}
