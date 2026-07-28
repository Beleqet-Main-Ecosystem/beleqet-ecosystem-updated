"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var PlagiarismService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlagiarismService = void 0;
const common_1 = require("@nestjs/common");
const chunker_service_1 = require("./chunker/chunker.service");
const history_service_1 = require("./history/history.service");
const internet_source_service_1 = require("./internet/internet-source.service");
const platform_source_service_1 = require("./platform/platform-source.service");
const report_service_1 = require("./report/report.service");
const score_aggregator_service_1 = require("./similarity/score-aggregator.service");
const normalization_service_1 = require("./utils/normalization.service");
const plagiarism_config_1 = require("./utils/plagiarism.config");
const math_utils_1 = require("./utils/math.utils");
let PlagiarismService = PlagiarismService_1 = class PlagiarismService {
    constructor(config, normalization, chunker, similarityEngine, platformSource, internetSource, reportService, historyService) {
        this.config = config;
        this.normalization = normalization;
        this.chunker = chunker;
        this.similarityEngine = similarityEngine;
        this.platformSource = platformSource;
        this.internetSource = internetSource;
        this.reportService = reportService;
        this.historyService = historyService;
        this.logger = new common_1.Logger(PlagiarismService_1.name);
    }
    async check(dto) {
        const threshold = dto.threshold ?? this.config.threshold;
        const normalizedText = this.normalization.normalize(dto.text.trim());
        const inputChunks = this.chunker.chunk(normalizedText);
        const [platformDocs, internetDocsFromSearch, internetDocsFromUrls] = await Promise.all([
            this.platformSource.loadDocuments(dto.excludeEntityId),
            this.internetSource.loadFromSearch(normalizedText),
            dto.sourceUrls?.length
                ? this.internetSource.loadFromUrls(dto.sourceUrls)
                : Promise.resolve([]),
        ]);
        const internetDocs = this.deduplicateDocuments([
            ...internetDocsFromSearch,
            ...internetDocsFromUrls,
        ]);
        const allDocuments = [...platformDocs, ...internetDocs];
        const matches = await this.findMatches(inputChunks, allDocuments, threshold);
        const result = this.reportService.buildReport({
            inputText: normalizedText,
            inputChunks,
            matches,
            platformDocCount: platformDocs.length,
            internetDocCount: internetDocs.length,
        });
        await this.historyService.save(result);
        this.logger.log(`Check ${result.checkId}: verdict=${result.verdict}, matches=${result.matchCount}, overall=${result.overallSimilarity}`);
        return result;
    }
    getHistory(limit = 20) {
        return this.historyService.findRecent(limit);
    }
    getCheckById(checkId) {
        return this.historyService.findById(checkId);
    }
    async findMatches(inputChunks, documents, threshold) {
        const matchResults = await Promise.all(documents.map((doc) => this.compareDocument(inputChunks, doc, threshold)));
        return matchResults
            .filter((m) => m !== null)
            .sort((a, b) => b.similarity - a.similarity);
    }
    async compareDocument(inputChunks, doc, threshold) {
        const sourceChunks = this.chunker.chunk(doc.content);
        if (sourceChunks.length === 0)
            return null;
        const matchedChunks = [];
        const allPhrases = [];
        const allTokens = [];
        const scoreAccumulator = { jaccard: 0, cosine: 0, ngram: 0, semantic: 0 };
        let bestChunkScore = 0;
        let comparisonCount = 0;
        for (const inputChunk of inputChunks) {
            for (const sourceChunk of sourceChunks) {
                const result = await this.similarityEngine.compare(inputChunk.text, sourceChunk.text);
                comparisonCount++;
                if (result.similarity > bestChunkScore) {
                    bestChunkScore = result.similarity;
                }
                if (result.similarity >= threshold) {
                    matchedChunks.push({
                        inputChunkIndex: inputChunk.index,
                        sourceChunkIndex: sourceChunk.index,
                        inputText: inputChunk.text,
                        sourceText: sourceChunk.text,
                        similarity: result.similarity,
                        algorithmScores: result.algorithmScores,
                    });
                }
                allPhrases.push(...result.matchedPhrases);
                allTokens.push(...result.matchedTokens);
                scoreAccumulator.jaccard += result.algorithmScores.jaccard;
                scoreAccumulator.cosine += result.algorithmScores.cosine;
                scoreAccumulator.ngram += result.algorithmScores.ngram;
                scoreAccumulator.semantic += result.algorithmScores.semantic;
            }
        }
        if (comparisonCount === 0)
            return null;
        const avgScores = {
            jaccard: scoreAccumulator.jaccard / comparisonCount,
            cosine: scoreAccumulator.cosine / comparisonCount,
            ngram: scoreAccumulator.ngram / comparisonCount,
            semantic: scoreAccumulator.semantic / comparisonCount,
        };
        const documentSimilarity = (0, math_utils_1.roundScore)(matchedChunks.length > 0
            ? matchedChunks.reduce((max, c) => Math.max(max, c.similarity), 0)
            : bestChunkScore);
        if (documentSimilarity < threshold)
            return null;
        const uniquePhrases = this.deduplicatePhrases(allPhrases);
        const uniqueTokens = [...new Set(allTokens)];
        return this.reportService.buildMatch(doc, documentSimilarity, {
            jaccard: (0, math_utils_1.roundScore)(avgScores.jaccard),
            cosine: (0, math_utils_1.roundScore)(avgScores.cosine),
            ngram: (0, math_utils_1.roundScore)(avgScores.ngram),
            semantic: (0, math_utils_1.roundScore)(avgScores.semantic),
        }, matchedChunks.sort((a, b) => b.similarity - a.similarity).slice(0, 10), uniquePhrases, uniqueTokens);
    }
    deduplicateDocuments(docs) {
        const seen = new Set();
        return docs.filter((doc) => {
            if (seen.has(doc.id))
                return false;
            seen.add(doc.id);
            return true;
        });
    }
    deduplicatePhrases(phrases) {
        const map = new Map();
        for (const phrase of phrases) {
            const existing = map.get(phrase.phrase);
            if (!existing || phrase.inputOccurrences > existing.inputOccurrences) {
                map.set(phrase.phrase, phrase);
            }
        }
        return [...map.values()];
    }
};
exports.PlagiarismService = PlagiarismService;
exports.PlagiarismService = PlagiarismService = PlagiarismService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [plagiarism_config_1.PlagiarismConfig,
        normalization_service_1.NormalizationService,
        chunker_service_1.ChunkerService,
        score_aggregator_service_1.SimilarityEngineService,
        platform_source_service_1.PlatformSourceService,
        internet_source_service_1.InternetSourceService,
        report_service_1.ReportService,
        history_service_1.HistoryService])
], PlagiarismService);
//# sourceMappingURL=plagiarism.service.js.map