"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var SemanticService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticService = void 0;
const common_1 = require("@nestjs/common");
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
let SemanticService = SemanticService_1 = class SemanticService {
    constructor() {
        this.name = 'semantic';
        this.logger = new common_1.Logger(SemanticService_1.name);
        this.extractor = null;
        this.initPromise = null;
        this.embeddingCache = new Map();
    }
    onModuleInit() {
        void this.ensureModel().catch((err) => {
            this.logger.warn(`Semantic model preload skipped: ${err instanceof Error ? err.message : err}`);
        });
    }
    async compare(textA, textB) {
        try {
            await this.ensureModel();
            if (!this.extractor) {
                return { score: 0 };
            }
            const [embeddingA, embeddingB] = await Promise.all([
                this.getEmbedding(textA),
                this.getEmbedding(textB),
            ]);
            const score = this.cosine(embeddingA, embeddingB);
            return { score };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Semantic comparison failed: ${message}`);
            return { score: 0 };
        }
    }
    async ensureModel() {
        if (this.extractor)
            return;
        if (this.initPromise)
            return this.initPromise;
        this.initPromise = (async () => {
            const { pipeline } = await Promise.resolve().then(() => require('@xenova/transformers'));
            this.extractor = (await pipeline('feature-extraction', MODEL_ID));
            this.logger.log(`Semantic model loaded: ${MODEL_ID}`);
        })();
        return this.initPromise;
    }
    async getEmbedding(text) {
        const cached = this.embeddingCache.get(text);
        if (cached)
            return cached;
        const output = await this.extractor(text, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data);
        this.embeddingCache.set(text, embedding);
        return embedding;
    }
    cosine(a, b) {
        if (a.length === 0 || b.length === 0)
            return 0;
        let dot = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
        }
        return Math.max(0, Math.min(1, dot));
    }
};
exports.SemanticService = SemanticService;
exports.SemanticService = SemanticService = SemanticService_1 = __decorate([
    (0, common_1.Injectable)()
], SemanticService);
//# sourceMappingURL=semantic.service.js.map