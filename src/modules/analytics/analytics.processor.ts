import { Processor, Process } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, ANALYTICS_JOBS } from '../queues/queues.constants';

@Injectable()
@Processor(QUEUE_NAMES.ANALYTICS)
export class AnalyticsProcessor {
  private readonly logger = new Logger(AnalyticsProcessor.name);
  constructor(private readonly prisma: PrismaService) {}

  @Process(ANALYTICS_JOBS.LOG_EVENT)
  async logEvent(job: Job<{ eventType: string; [key: string]: unknown }>) {
    await this.prisma.eventLog.create({
      data: {
        eventType: job.data.eventType,
        entityId: String(job.data.jobId ?? job.data.applicationId ?? 'global'),
        entityType: 'Analytics',
        payload: job.data as never,
        processedBy: AnalyticsProcessor.name,
      },
    });
  }

  @Process(ANALYTICS_JOBS.UPDATE_JOB_STATS)
  async updateJobStats(job: Job<{ jobId: string }>) {
    const count = await this.prisma.application.count({ where: { jobId: job.data.jobId } });
    this.logger.debug(`Job ${job.data.jobId} now has ${count} applications`);
  }
}
