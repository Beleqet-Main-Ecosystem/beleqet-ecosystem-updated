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
exports.PlagiarismConfig = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const DEFAULT_WEIGHTS = {
    jaccard: 0.2,
    cosine: 0.25,
    ngram: 0.2,
    semantic: 0.35,
};
let PlagiarismConfig = class PlagiarismConfig {
    constructor(config) {
        this.config = config;
        this.threshold = this.parseFloat('PLAGIARISM_THRESHOLD', 0.25);
        this.enableWebSearch = this.parseBool('ENABLE_WEB_SEARCH', true);
        this.searchProvider = this.parseSearchProvider();
        this.exaApiKey = this.config.get('EXA_API_KEY');
        this.searxngUrl = this.config.get('SEARXNG_URL');
        this.similarityWeights = this.parseWeights();
        this.maxPlatformDocuments = this.parseInt('MAX_PLATFORM_DOCUMENTS', 100);
        this.maxWebResults = this.parseInt('MAX_WEB_RESULTS', 5);
        this.verdictOriginalMax = this.parseFloat('VERDICT_ORIGINAL_MAX', 0.3);
        this.verdictSuspiciousMax = this.parseFloat('VERDICT_SUSPICIOUS_MAX', 0.6);
        this.earlyExitThreshold = this.parseFloat('EARLY_EXIT_THRESHOLD', 0.05);
        this.maxParagraphLength = this.parseInt('MAX_PARAGRAPH_LENGTH', 500);
        this.fetchTimeoutMs = this.parseInt('PLAGIARISM_FETCH_TIMEOUT_MS', 8000);
    }
    resolveVerdict(similarity) {
        if (similarity >= this.verdictSuspiciousMax)
            return 'likely_plagiarized';
        if (similarity >= this.verdictOriginalMax)
            return 'suspicious';
        return 'original';
    }
    parseFloat(key, fallback) {
        const raw = this.config.get(key);
        if (raw === undefined)
            return fallback;
        const parsed = parseFloat(raw);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    parseInt(key, fallback) {
        const raw = this.config.get(key);
        if (raw === undefined)
            return fallback;
        const parsed = parseInt(raw, 10);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    parseBool(key, fallback) {
        const raw = this.config.get(key);
        if (raw === undefined)
            return fallback;
        return raw.toLowerCase() === 'true' || raw === '1';
    }
    parseSearchProvider() {
        const raw = (this.config.get('SEARCH_PROVIDER') ?? 'duckduckgo').toLowerCase();
        if (raw === 'exa' || raw === 'searxng')
            return raw;
        return 'duckduckgo';
    }
    parseWeights() {
        const raw = this.config.get('SIMILARITY_WEIGHTS');
        if (!raw)
            return { ...DEFAULT_WEIGHTS };
        try {
            const parsed = JSON.parse(raw);
            return {
                jaccard: parsed.jaccard ?? DEFAULT_WEIGHTS.jaccard,
                cosine: parsed.cosine ?? DEFAULT_WEIGHTS.cosine,
                ngram: parsed.ngram ?? DEFAULT_WEIGHTS.ngram,
                semantic: parsed.semantic ?? DEFAULT_WEIGHTS.semantic,
            };
        }
        catch {
            return { ...DEFAULT_WEIGHTS };
        }
    }
};
exports.PlagiarismConfig = PlagiarismConfig;
exports.PlagiarismConfig = PlagiarismConfig = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PlagiarismConfig);
//# sourceMappingURL=plagiarism.config.js.map