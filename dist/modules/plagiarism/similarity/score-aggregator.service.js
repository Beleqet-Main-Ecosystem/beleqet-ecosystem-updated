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
exports.SimilarityEngineService = exports.ScoreAggregatorService = void 0;
const common_1 = require("@nestjs/common");
const math_utils_1 = require("../utils/math.utils");
const plagiarism_config_1 = require("../utils/plagiarism.config");
const cosine_service_1 = require("./cosine.service");
const jaccard_service_1 = require("./jaccard.service");
const ngram_service_1 = require("./ngram.service");
const semantic_service_1 = require("./semantic.service");
let ScoreAggregatorService = class ScoreAggregatorService {
    constructor(config) {
        this.config = config;
    }
    aggregate(scores, weights = this.config.similarityWeights) {
        const weighted = scores.jaccard * weights.jaccard +
            scores.cosine * weights.cosine +
            scores.ngram * weights.ngram +
            scores.semantic * weights.semantic;
        return (0, math_utils_1.roundScore)(Math.max(0, Math.min(1, weighted)));
    }
    buildResult(scores, matchedTokens, matchedPhrases) {
        return {
            similarity: this.aggregate(scores),
            algorithmScores: {
                jaccard: (0, math_utils_1.roundScore)(scores.jaccard),
                cosine: (0, math_utils_1.roundScore)(scores.cosine),
                ngram: (0, math_utils_1.roundScore)(scores.ngram),
                semantic: (0, math_utils_1.roundScore)(scores.semantic),
            },
            matchedTokens,
            matchedPhrases,
        };
    }
};
exports.ScoreAggregatorService = ScoreAggregatorService;
exports.ScoreAggregatorService = ScoreAggregatorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [plagiarism_config_1.PlagiarismConfig])
], ScoreAggregatorService);
let SimilarityEngineService = class SimilarityEngineService {
    constructor(jaccard, cosine, ngram, semantic, aggregator, config) {
        this.jaccard = jaccard;
        this.cosine = cosine;
        this.ngram = ngram;
        this.semantic = semantic;
        this.aggregator = aggregator;
        this.config = config;
    }
    async compare(textA, textB, skipSemantic = false) {
        const jaccardResult = this.jaccard.compare(textA, textB);
        const cosineResult = this.cosine.compare(textA, textB);
        const ngramResult = this.ngram.compare(textA, textB);
        const quickScore = jaccardResult.score * 0.4 + cosineResult.score * 0.3 + ngramResult.score * 0.3;
        let semanticScore = 0;
        if (!skipSemantic && quickScore >= this.config.earlyExitThreshold) {
            const semanticResult = await this.semantic.compare(textA, textB);
            semanticScore = semanticResult.score;
        }
        const scores = {
            jaccard: jaccardResult.score,
            cosine: cosineResult.score,
            ngram: ngramResult.score,
            semantic: semanticScore,
        };
        const matchedTokens = [
            ...new Set([...(jaccardResult.matchedTokens ?? []), ...(cosineResult.matchedTokens ?? [])]),
        ];
        const matchedPhrases = ngramResult.matchedPhrases ?? [];
        return this.aggregator.buildResult(scores, matchedTokens, matchedPhrases);
    }
};
exports.SimilarityEngineService = SimilarityEngineService;
exports.SimilarityEngineService = SimilarityEngineService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jaccard_service_1.JaccardService,
        cosine_service_1.CosineService,
        ngram_service_1.NgramService,
        semantic_service_1.SemanticService,
        ScoreAggregatorService,
        plagiarism_config_1.PlagiarismConfig])
], SimilarityEngineService);
//# sourceMappingURL=score-aggregator.service.js.map