import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { PrismaModule } from '../../prisma/prisma.module';
import { InterviewPlannerController } from './interview-planner.controller';
import { InterviewPlannerService } from './interview-planner.service';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { AvailabilityHelper } from './helpers/availability.helper';
import { CommonAvailabilityHelper } from './helpers/common-availability.helper';
import { ApplicationHelper } from './helpers/application.helper';
import { DateHelper } from './helpers/date.helper';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,

    BullModule.registerQueue({
      name: QUEUE_NAMES.NOTIFICATIONS,
    }),
  ],
  controllers: [InterviewPlannerController],
  providers: [
    InterviewPlannerService,
    AvailabilityHelper,
    CommonAvailabilityHelper,
    ApplicationHelper,
    DateHelper,
  ],
  exports: [InterviewPlannerService],
})
export class InterviewPlannerModule {}
