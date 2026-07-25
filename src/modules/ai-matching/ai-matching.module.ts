import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { EmbeddingService } from './services/embedding.service';
import { VectorSearchService } from './services/vector-search.service';
import { SanitizerService } from './services/sanitizer.service';
import { PromptService } from './services/prompt.service';
import { LlmEvaluationService } from './services/llm-evaluation.service';
import { ScoringService } from './services/scoring.service';
import { RankingService } from './services/ranking.service';
import { MatchingService } from './services/matching.service';
import { OpenAiEmbeddingProvider } from './services/openai-embedding.provider';
import { MockEmbeddingProvider } from './services/mock-embedding.provider';
import { PgVectorSearchProvider } from './services/pgvector-search.provider';
import { OpenAILLMProvider } from './services/openai-llm.provider';
import { MockLLMProvider } from './services/mock-llm.provider';
import { EMBEDDING_PROVIDER } from './services/embedding-provider.token';
import { VECTOR_PROVIDER } from './services/vector-provider.token';
import { LLM_PROVIDER } from './services/llm-provider.token';
import { defaultEmbeddingConfig } from './config/embedding.config';
import { defaultVectorSearchConfig } from './config/vector-search.config';
import { defaultScoringConfig } from './config/scoring.config';
import { MatchingController } from './controllers/matching.controller';
import { InsightsController } from './controllers/insights.controller';
import { AdminMatchingController } from './controllers/admin-matching.controller';
import { MatchingProcessor } from './services/matching.processor';
import { EmbeddingWorkerService } from './services/embedding-worker.service';
import { EmbeddingQueueService } from './services/embedding-queue.service';
import { MetricsService } from './services/metrics.service';
import { TokenUsageService } from './services/token-usage.service';
import { InsightsService } from './services/insights.service';

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_NAMES.MATCHING })],
  controllers: [MatchingController, InsightsController, AdminMatchingController],
  providers: [
    EmbeddingService,
    VectorSearchService,
    SanitizerService,
    PromptService,
    LlmEvaluationService,
    ScoringService,
    RankingService,
    MatchingService,
    MetricsService,
    TokenUsageService,
    InsightsService,

    MatchingProcessor,
    EmbeddingWorkerService,
    EmbeddingQueueService,

    {
      provide: EMBEDDING_PROVIDER,
      useFactory: (config: ConfigService) =>
        config.get<string>('USE_MOCK_AI_PROVIDERS') === 'true'
          ? new MockEmbeddingProvider()
          : new OpenAiEmbeddingProvider(config),
      inject: [ConfigService],
    },
    { provide: VECTOR_PROVIDER, useClass: PgVectorSearchProvider },
    {
      provide: LLM_PROVIDER,
      useFactory: (config: ConfigService) =>
        config.get<string>('USE_MOCK_AI_PROVIDERS') === 'true'
          ? new MockLLMProvider()
          : new OpenAILLMProvider(config),
      inject: [ConfigService],
    },

    { provide: 'EMBEDDING_CONFIG', useValue: defaultEmbeddingConfig },
    { provide: 'VECTOR_SEARCH_CONFIG', useValue: defaultVectorSearchConfig },
    { provide: 'SCORING_CONFIG', useValue: defaultScoringConfig },
  ],
  exports: [MatchingService, EmbeddingQueueService],
})
export class AiMatchingModule {}
