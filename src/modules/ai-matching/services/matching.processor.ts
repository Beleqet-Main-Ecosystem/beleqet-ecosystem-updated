import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, MATCHING_JOBS } from '../../queues/queues.constants';
import { EmbeddingWorkerService } from './embedding-worker.service';
import type { GenerateEmbeddingsPayload } from './embedding-worker.service';

@Injectable()
@Processor(QUEUE_NAMES.MATCHING)
export class MatchingProcessor extends WorkerHost {
  private readonly logger = new Logger(MatchingProcessor.name);

  constructor(private readonly embeddingWorker: EmbeddingWorkerService) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case MATCHING_JOBS.GENERATE_EMBEDDINGS:
        return this.handleGenerateEmbeddings(job as Job<GenerateEmbeddingsPayload>);
      default:
        this.logger.warn(`Unknown matching job: ${job.name}`);
    }
  }

  private async handleGenerateEmbeddings(job: Job<GenerateEmbeddingsPayload>): Promise<void> {
    const report = await this.embeddingWorker.generateEmbeddings(job.data);
    this.logger.log(
      `[${job.id}] Embedding ${job.data.entityType}: ${report.succeeded}/${report.processed} ok, ${report.failed} failed`,
    );
  }
}
