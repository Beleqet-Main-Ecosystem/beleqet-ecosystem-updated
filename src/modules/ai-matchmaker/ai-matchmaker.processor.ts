import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, AI_MATCHMAKER_JOBS } from '../queues/queues.constants';
import { AiMatchmakerService } from './ai-matchmaker.service';

interface MatchJobPayload {
  jobId: string;
}

/**
 * AiMatchmakerProcessor
 *
 * BullMQ Worker processing asynchronous match calculation tasks in background threads.
 * Prevents main thread HTTP event loop blocking during high-volume candidate evaluations.
 */
@Injectable()
@Processor(QUEUE_NAMES.AI_MATCHMAKER)
export class AiMatchmakerProcessor extends WorkerHost {
  private readonly logger = new Logger(AiMatchmakerProcessor.name);

  constructor(private readonly matchmakerService: AiMatchmakerService) {
    super();
  }

  /**
   * Central BullMQ processing router
   */
  async process(job: Job<MatchJobPayload>): Promise<any> {
    this.logger.log(`Processing BullMQ job [${job.name}] with ID ${job.id}`);

    switch (job.name) {
      case AI_MATCHMAKER_JOBS.CALCULATE_JOB_MATCHES: {
        const { jobId } = job.data;
        const count = await this.matchmakerService.batchCalculateForJob(jobId);
        return { jobId, processedCount: count };
      }

      default:
        this.logger.warn(`Unmapped AI Matchmaker queue job received: ${job.name}`);
        return { skipped: true };
    }
  }
}
