"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenizerService = void 0;
const common_1 = require("@nestjs/common");
const stop_words_1 = require("./stop-words");
const FRENCH_STOP_WORDS = new Set([
    'le',
    'la',
    'les',
    'de',
    'des',
    'du',
    'un',
    'une',
    'et',
    'est',
    'dans',
    'pour',
    'que',
    'qui',
    'sur',
    'avec',
    'pas',
    'plus',
    'par',
    'ce',
    'cette',
    'ses',
    'son',
    'sa',
    'nos',
    'notre',
    'vos',
    'votre',
    'leur',
    'leurs',
    'au',
    'aux',
    'en',
]);
const ALL_STOP_WORDS = new Set([...stop_words_1.STOP_WORDS, ...FRENCH_STOP_WORDS]);
const MIN_TOKEN_LENGTH = 3;
let TokenizerService = class TokenizerService {
    constructor() {
        this.cache = new Map();
    }
    tokenize(text) {
        const normalized = text
            .normalize('NFKC')
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!normalized)
            return [];
        return normalized
            .split(/\s+/)
            .filter((word) => word.length >= MIN_TOKEN_LENGTH && !ALL_STOP_WORDS.has(word));
    }
    tokenizeCached(text) {
        const cached = this.cache.get(text);
        if (cached)
            return cached;
        const tokens = this.tokenize(text);
        this.cache.set(text, tokens);
        return tokens;
    }
    clearCache() {
        this.cache.clear();
    }
};
exports.TokenizerService = TokenizerService;
exports.TokenizerService = TokenizerService = __decorate([
    (0, common_1.Injectable)()
], TokenizerService);
//# sourceMappingURL=tokenizer.service.js.map