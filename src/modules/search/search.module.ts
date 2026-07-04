import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { SearchIndexProcessor } from './search-index.processor';

/**
 * SearchModule — Phase 2
 *
 * Consumes the 'search-index' BullMQ queue and keeps an OpenSearch/
 * Elasticsearch index in sync with the PostgreSQL jobs & freelance_jobs tables.
 *
 * To activate:
 *   1. Install: npm install @opensearch-project/opensearch
 *   2. Add OPENSEARCH_URL to .env
 *   3. Uncomment the OpenSearchService provider below
 *   4. Add SearchModule to app.module.ts imports
 */
@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.SEARCH_INDEX })],
  providers: [SearchIndexProcessor],
})
export class SearchModule {}
