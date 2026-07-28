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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const math_utils_1 = require("../utils/math.utils");
const plagiarism_config_1 = require("../utils/plagiarism.config");
const quality_analyzer_service_1 = require("./quality-analyzer.service");
let ReportService = class ReportService {
    constructor(config, qualityAnalyzer) {
        this.config = config;
        this.qualityAnalyzer = qualityAnalyzer;
    }
    buildReport(input) {
        const overallSimilarity = input.matches.length > 0 ? input.matches[0].similarity : 0;
        const averageSimilarity = input.matches.length > 0
            ? (0, math_utils_1.roundScore)(input.matches.reduce((sum, m) => sum + m.similarity, 0) / input.matches.length)
            : 0;
        const qualityAssessment = this.qualityAnalyzer.analyze(input.inputText, overallSimilarity);
        const qualityScore = this.qualityAnalyzer.computeQualityScore(qualityAssessment);
        return {
            checkId: (0, crypto_1.randomUUID)(),
            inputLength: input.inputText.length,
            overallSimilarity,
            maxSimilarity: overallSimilarity,
            averageSimilarity,
            matchCount: input.matches.length,
            verdict: this.config.resolveVerdict(overallSimilarity),
            qualityScore,
            qualityAssessment,
            sourcesChecked: input.platformDocCount,
            internetSourcesChecked: input.internetDocCount,
            matches: input.matches,
            checkedAt: new Date().toISOString(),
        };
    }
    buildMatch(doc, documentSimilarity, algorithmScores, matchedChunks, matchedPhrases, matchedTokens) {
        return {
            sourceType: doc.sourceType,
            entityType: doc.entityType,
            entityId: doc.id,
            title: doc.title,
            similarity: (0, math_utils_1.roundScore)(documentSimilarity),
            algorithmScores,
            matchedChunks,
            matchedPhrases: matchedPhrases.slice(0, 20),
            matchedTokens: matchedTokens.slice(0, 20),
            sourceUrl: doc.sourceUrl,
        };
    }
};
exports.ReportService = ReportService;
exports.ReportService = ReportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [plagiarism_config_1.PlagiarismConfig,
        quality_analyzer_service_1.QualityAnalyzerService])
], ReportService);
//# sourceMappingURL=report.service.js.map