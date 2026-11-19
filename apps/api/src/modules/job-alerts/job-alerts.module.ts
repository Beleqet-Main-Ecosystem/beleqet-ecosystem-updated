import { Module } from '@nestjs/common';
import { JobAlertsController } from './job-alerts.controller';
import { JobAlertsService } from './job-alerts.service';

@Module({
  controllers: [JobAlertsController],
  providers: [JobAlertsService],
})
export class JobAlertsModule {}
