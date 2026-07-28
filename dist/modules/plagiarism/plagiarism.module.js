"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlagiarismModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const chunker_service_1 = require("./chunker/chunker.service");
const history_service_1 = require("./history/history.service");
const internet_source_service_1 = require("./internet/internet-source.service");
const keyword_extractor_service_1 = require("./internet/keyword-extractor.service");
const exa_search_provider_1 = require("./internet/search/exa-search.provider");
const duckduckgo_search_provider_1 = require("./internet/search/duckduckgo-search.provider");
const searxng_search_provider_1 = require("./internet/search/searxng-search.provider");
const web_search_service_1 = require("./internet/search/web-search.service");
const platform_source_service_1 = require("./platform/platform-source.service");
const plagiarism_controller_1 = require("./plagiarism.controller");
const plagiarism_service_1 = require("./plagiarism.service");
const quality_analyzer_service_1 = require("./report/quality-analyzer.service");
const report_service_1 = require("./report/report.service");
const cosine_service_1 = require("./similarity/cosine.service");
const jaccard_service_1 = require("./similarity/jaccard.service");
const ngram_service_1 = require("./similarity/ngram.service");
const score_aggregator_service_1 = require("./similarity/score-aggregator.service");
const semantic_service_1 = require("./similarity/semantic.service");
const tokenizer_service_1 = require("./tokenizer/tokenizer.service");
const normalization_service_1 = require("./utils/normalization.service");
const plagiarism_config_1 = require("./utils/plagiarism.config");
let PlagiarismModule = class PlagiarismModule {
};
exports.PlagiarismModule = PlagiarismModule;
exports.PlagiarismModule = PlagiarismModule = __decorate([
    (0, common_1.Module)({
        imports: [config_1.ConfigModule],
        controllers: [plagiarism_controller_1.PlagiarismController],
        providers: [
            plagiarism_config_1.PlagiarismConfig,
            plagiarism_service_1.PlagiarismService,
            normalization_service_1.NormalizationService,
            chunker_service_1.ChunkerService,
            tokenizer_service_1.TokenizerService,
            jaccard_service_1.JaccardService,
            cosine_service_1.CosineService,
            ngram_service_1.NgramService,
            semantic_service_1.SemanticService,
            score_aggregator_service_1.ScoreAggregatorService,
            score_aggregator_service_1.SimilarityEngineService,
            platform_source_service_1.PlatformSourceService,
            internet_source_service_1.InternetSourceService,
            keyword_extractor_service_1.KeywordExtractorService,
            web_search_service_1.WebSearchService,
            exa_search_provider_1.ExaSearchProvider,
            duckduckgo_search_provider_1.DuckDuckGoSearchProvider,
            searxng_search_provider_1.SearxngSearchProvider,
            report_service_1.ReportService,
            quality_analyzer_service_1.QualityAnalyzerService,
            history_service_1.HistoryService,
        ],
        exports: [plagiarism_service_1.PlagiarismService],
    })
], PlagiarismModule);
//# sourceMappingURL=plagiarism.module.js.map