import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, ANALYTICS_JOBS } from '../queues/queues.constants';

@Injectable()
@Processor(QUEUE_NAMES.ANALYTICS)
export class AnalyticsProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalyticsProcessor.name);
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case ANALYTICS_JOBS.LOG_EVENT:
        await this.prisma.eventLog.create({
          data: {
            eventType: job.data.eventType,
            entityId: String(job.data.jobId ?? job.data.applicationId ?? 'global'),
            entityType: 'Analytics',
            payload: job.data as never,
            processedBy: AnalyticsProcessor.name,
          },
        });
        break;

      case ANALYTICS_JOBS.UPDATE_JOB_STATS:
        const count = await this.prisma.application.count({ where: { jobId: job.data.jobId } });
        this.logger.debug(`Job ${job.data.jobId} now has ${count} applications`);
        break;

      default:
        this.logger.warn(`Unknown job name: ${job.name} on analytics queue`);
    }
  }
}