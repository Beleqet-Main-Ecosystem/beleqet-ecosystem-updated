import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { TWO_FACTOR_JOBS } from '../queues/queues.constants';

@Processor('scheduled')
export class TwoFactorProcessor {
  private readonly logger = new Logger(TwoFactorProcessor.name);

  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Process(TWO_FACTOR_JOBS.CLEANUP_EXPIRED_ENROLLMENT)
  async handleCleanup(job: Job) {
    this.logger.log(`Processing cleanup job ${job.id}`);
    const count = await this.twoFactorService.cleanupExpiredEnrollments();
    this.logger.log(`Cleanup complete: ${count} expired enrollments removed`);
  }
}
