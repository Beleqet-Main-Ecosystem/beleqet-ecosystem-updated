import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { PrismaModule } from '../../prisma/prisma.module';
import { AlertingService } from './alerting.service';
import { AnomalySensorService } from './anomaly-sensor.service';

/**
 * AnomalySensorModule - Connects the anomaly detection engine (AnomalySensorService)
 * and alerting mechanisms (AlertingService) to the rest of the application.
 * Imports Prisma for audit logging and Bull for alert dispatching.
 */
@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.NOTIFICATIONS,
    }),
  ],
  providers: [AlertingService, AnomalySensorService],
  exports: [AnomalySensorService],
})
export class AnomalySensorModule {}
