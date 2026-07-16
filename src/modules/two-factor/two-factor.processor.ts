import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { TWO_FACTOR_JOBS } from '../queues/queues.constants';

@Processor('scheduled')
export class TwoFactorProcessor extends WorkerHost {
  private readonly logger = new Logger(TwoFactorProcessor.name);

  constructor(private readonly twoFactorService: TwoFactorService) {
    super(); // Required when extending WorkerHost
  }

  // Unified entry point for all jobs on the 'scheduled' queue
  async process(job: Job): Promise<any> {
    switch (job.name) {
      case TWO_FACTOR_JOBS.CLEANUP_EXPIRED_ENROLLMENT:
        return await this.handleCleanup(job);

      default:
        this.logger.warn(`Unknown job name: ${job.name} on 'scheduled' queue`);
        return null;
    }
  }

  private async handleCleanup(job: Job) {
    this.logger.log(`Processing cleanup job ${job.id}`);
    const count = await this.twoFactorService.cleanupExpiredEnrollments();
    this.logger.log(`Cleanup complete: ${count} expired enrollments removed`);
    return count;
  }
}