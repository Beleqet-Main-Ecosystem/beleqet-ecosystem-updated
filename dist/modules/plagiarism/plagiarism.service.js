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
const crypto_1 = require("crypto");
const history_service_1 = require("./history/history.service");
const similarity_service_1 = require("./similarity.service.ts/similarity.service");
const internet_source_service_1 = require("./sources/internet-source.service");
const platform_source_service_1 = require("./sources/platform-source.service");
const DEFAULT_THRESHOLD = 0.25;
const VERDICT_SUSPICIOUS = 0.35;
const VERDICT_PLAGIARIZED = 0.6;
let PlagiarismService = PlagiarismService_1 = class PlagiarismService {
    constructor(similarityService, platformSource, internetSource, historyService) {
        this.similarityService = similarityService;
        this.platformSource = platformSource;
        this.internetSource = internetSource;
        this.historyService = historyService;
        this.logger = new common_1.Logger(PlagiarismService_1.name);
    }
    async check(dto) {
        const threshold = dto.threshold ?? DEFAULT_THRESHOLD;
        const trimmedText = dto.text.trim();
        const [platformDocs, internetDocs] = await Promise.all([
            this.platformSource.loadDocuments(dto.excludeEntityId),
            dto.sourceUrls?.length
                ? this.internetSource.loadFromUrls(dto.sourceUrls)
                : Promise.resolve([]),
        ]);
        const allDocuments = [...platformDocs, ...internetDocs];
        const matches = this.findMatches(trimmedText, allDocuments, threshold);
        const result = this.buildResult(trimmedText, matches);
        await this.historyService.save(result);
        this.logger.log(`Check ${result.checkId}: verdict=${result.verdict}, matches=${result.matchCount}`);
        return result;
    }
    getHistory(limit = 20) {
        return this.historyService.findRecent(limit);
    }
    getCheckById(checkId) {
        return this.historyService.findById(checkId);
    }
    findMatches(inputText, documents, threshold) {
        const matches = [];
        for (const doc of documents) {
            const { score, matchedTokens } = this.similarityService.compare(inputText, doc.content);
            if (score >= threshold) {
                matches.push({
                    sourceType: doc.sourceType,
                    entityType: doc.entityType,
                    entityId: doc.id,
                    title: doc.title,
                    similarity: roundScore(score),
                    matchedTokens: matchedTokens.slice(0, 20),
                    sourceUrl: doc.sourceUrl,
                });
            }
        }
        return matches.sort((a, b) => b.similarity - a.similarity);
    }
    buildResult(inputText, matches) {
        const maxSimilarity = matches.length > 0 ? matches[0].similarity : 0;
        const averageSimilarity = matches.length > 0
            ? roundScore(matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length)
            : 0;
        return {
            checkId: (0, crypto_1.randomUUID)(),
            inputLength: inputText.length,
            maxSimilarity,
            averageSimilarity,
            matchCount: matches.length,
            verdict: this.resolveVerdict(maxSimilarity),
            matches,
            checkedAt: new Date().toISOString(),
        };
    }
    resolveVerdict(maxSimilarity) {
        if (maxSimilarity >= VERDICT_PLAGIARIZED)
            return 'likely_plagiarized';
        if (maxSimilarity >= VERDICT_SUSPICIOUS)
            return 'suspicious';
        return 'original';
    }
};
exports.PlagiarismService = PlagiarismService;
exports.PlagiarismService = PlagiarismService = PlagiarismService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [similarity_service_1.SimilarityService,
        platform_source_service_1.PlatformSourceService,
        internet_source_service_1.InternetSourceService,
        history_service_1.HistoryService])
], PlagiarismService);
function roundScore(score) {
    return Math.round(score * 10_000) / 10_000;
}
//# sourceMappingURL=plagiarism.service.js.map