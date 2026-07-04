import { Processor, Process } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job as BullJob } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queues/queues.constants';

interface IndexJobPayload {
  action: 'upsert' | 'delete';
  entityType: 'job' | 'freelance_job';
  entityId: string;
}

/**
 * SearchIndexProcessor — Phase 2
 *
 * Keeps OpenSearch in sync with PostgreSQL.
 * Every job or freelance_job create/update/delete enqueues a message here.
 * The processor fetches the latest data from Postgres and upserts/deletes
 * the OpenSearch document.
 *
 * Decoupled by design: Postgres is always the source of truth.
 * If OpenSearch goes down, queue messages accumulate in Redis and replay
 * automatically when the service recovers.
 */
@Injectable()
@Processor(QUEUE_NAMES.SEARCH_INDEX)
export class SearchIndexProcessor {
  private readonly logger = new Logger(SearchIndexProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('index-job')
  async indexJob(job: BullJob<IndexJobPayload>) {
    const { action, entityType, entityId } = job.data;

    if (action === 'delete') {
      // await this.opensearch.delete({ index: entityType, id: entityId });
      this.logger.debug(`[search-index] Delete ${entityType}:${entityId}`);
      return;
    }

    if (entityType === 'job') {
      const data = await this.prisma.job.findUnique({
        where: { id: entityId },
        include: { company: true, category: true },
      });
      if (!data) return;

      // Phase 2: upsert into OpenSearch
      // await this.opensearch.index({ index: 'jobs', id: entityId, body: data });
      this.logger.debug(`[search-index] Indexed job:${entityId} "${data.title}"`);
    }

    if (entityType === 'freelance_job') {
      const data = await this.prisma.freelanceJob.findUnique({
        where: { id: entityId },
        include: { category: true },
      });
      if (!data) return;

      // Phase 2: upsert into OpenSearch
      // await this.opensearch.index({ index: 'freelance_jobs', id: entityId, body: data });
      this.logger.debug(`[search-index] Indexed freelance_job:${entityId} "${data.title}"`);
    }
  }
}
