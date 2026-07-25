import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES, MATCHING_JOBS } from '../../queues/queues.constants';
import type { GenerateEmbeddingsPayload } from './embedding-worker.service';

/**
 * Service that other modules (UserService, FreelanceJobService) can inject
 * to enqueue embedding regeneration jobs after profile/job updates.
 */
@Injectable()
export class EmbeddingQueueService {
  private readonly logger = new Logger(EmbeddingQueueService.name);

  constructor(@InjectQueue(QUEUE_NAMES.MATCHING) private readonly queue: Queue) {}

  /**
   * Schedule a background embedding regeneration for a single entity.
   * Called after a user updates their profile or a freelance job is created/edited.
   */
  async scheduleEmbeddingUpdate(
    entityType: GenerateEmbeddingsPayload['entityType'],
    entityId: string,
  ): Promise<void> {
    await this.queue.add(
      MATCHING_JOBS.GENERATE_EMBEDDINGS,
      { entityType, entityId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );
    this.logger.log(`Scheduled embedding update for ${entityType} ${entityId}`);
  }

  /**
   * Schedule a full re-index of all entities of a given type.
   * Useful for initial seed or daily maintenance.
   */
  async scheduleFullReindex(entityType: GenerateEmbeddingsPayload['entityType']): Promise<void> {
    await this.queue.add(
      MATCHING_JOBS.GENERATE_EMBEDDINGS,
      { entityType },
      {
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );
    this.logger.log(`Scheduled full embedding re-index for ${entityType}`);
  }
}
