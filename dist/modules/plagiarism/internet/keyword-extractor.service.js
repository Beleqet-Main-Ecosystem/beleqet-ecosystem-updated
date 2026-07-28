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
exports.KeywordExtractorService = void 0;
const common_1 = require("@nestjs/common");
const tokenizer_service_1 = require("../tokenizer/tokenizer.service");
const KEYWORD_COUNT = 6;
let KeywordExtractorService = class KeywordExtractorService {
    constructor(tokenizer) {
        this.tokenizer = tokenizer;
    }
    extractQuery(text) {
        const tokens = this.tokenizer.tokenize(text);
        if (tokens.length === 0)
            return text.slice(0, 100);
        const frequency = new Map();
        for (const token of tokens) {
            frequency.set(token, (frequency.get(token) ?? 0) + 1);
        }
        const topKeywords = [...frequency.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, KEYWORD_COUNT)
            .map(([word]) => word);
        return topKeywords.join(' ');
    }
};
exports.KeywordExtractorService = KeywordExtractorService;
exports.KeywordExtractorService = KeywordExtractorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tokenizer_service_1.TokenizerService])
], KeywordExtractorService);
//# sourceMappingURL=keyword-extractor.service.js.map