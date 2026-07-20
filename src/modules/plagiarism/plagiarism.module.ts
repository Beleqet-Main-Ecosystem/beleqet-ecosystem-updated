import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChunkerService } from './chunker/chunker.service';
import { HistoryService } from './history/history.service';
import { InternetSourceService } from './internet/internet-source.service';
import { KeywordExtractorService } from './internet/keyword-extractor.service';
import { ExaSearchProvider } from './internet/search/exa-search.provider';
import { DuckDuckGoSearchProvider } from './internet/search/duckduckgo-search.provider';
import { SearxngSearchProvider } from './internet/search/searxng-search.provider';
import { WebSearchService } from './internet/search/web-search.service';
import { PlatformSourceService } from './platform/platform-source.service';
import { PlagiarismController } from './plagiarism.controller';
import { PlagiarismService } from './plagiarism.service';
import { QualityAnalyzerService } from './report/quality-analyzer.service';
import { ReportService } from './report/report.service';
import { CosineService } from './similarity/cosine.service';
import { JaccardService } from './similarity/jaccard.service';
import { NgramService } from './similarity/ngram.service';
import { ScoreAggregatorService, SimilarityEngineService } from './similarity/score-aggregator.service';
import { SemanticService } from './similarity/semantic.service';
import { TokenizerService } from './tokenizer/tokenizer.service';
import { NormalizationService } from './utils/normalization.service';
import { PlagiarismConfig } from './utils/plagiarism.config';

@Module({
  imports: [ConfigModule],
  controllers: [PlagiarismController],
  providers: [
    PlagiarismConfig,
    PlagiarismService,
    NormalizationService,
    ChunkerService,
    TokenizerService,
    JaccardService,
    CosineService,
    NgramService,
    SemanticService,
    ScoreAggregatorService,
    SimilarityEngineService,
    PlatformSourceService,
    InternetSourceService,
    KeywordExtractorService,
    WebSearchService,
    ExaSearchProvider,
    DuckDuckGoSearchProvider,
    SearxngSearchProvider,
    ReportService,
    QualityAnalyzerService,
    HistoryService,
  ],
  exports: [PlagiarismService],
})
export class PlagiarismModule {}
