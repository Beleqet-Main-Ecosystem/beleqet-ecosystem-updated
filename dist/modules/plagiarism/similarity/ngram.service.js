"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NgramService = void 0;
const common_1 = require("@nestjs/common");
const NGRAM_SIZES = [3, 4];
let NgramService = class NgramService {
    constructor() {
        this.name = 'ngram';
    }
    compare(textA, textB) {
        const normalizedA = this.normalizeForNgrams(textA);
        const normalizedB = this.normalizeForNgrams(textB);
        if (normalizedA.length < 3 || normalizedB.length < 3) {
            return { score: 0, matchedPhrases: [] };
        }
        let totalScore = 0;
        const allMatchedPhrases = [];
        for (const size of NGRAM_SIZES) {
            const ngramsA = this.buildNgrams(normalizedA, size);
            const ngramsB = this.buildNgrams(normalizedB, size);
            const { score, matched } = this.jaccardNgrams(ngramsA, ngramsB);
            totalScore += score;
            for (const phrase of matched) {
                allMatchedPhrases.push({
                    phrase,
                    inputOccurrences: ngramsA.get(phrase) ?? 0,
                    sourceOccurrences: ngramsB.get(phrase) ?? 0,
                });
            }
        }
        const score = totalScore / NGRAM_SIZES.length;
        return { score, matchedPhrases: allMatchedPhrases.slice(0, 20) };
    }
    normalizeForNgrams(text) {
        return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
    }
    buildNgrams(text, size) {
        const ngrams = new Map();
        for (let i = 0; i <= text.length - size; i++) {
            const gram = text.slice(i, i + size);
            ngrams.set(gram, (ngrams.get(gram) ?? 0) + 1);
        }
        return ngrams;
    }
    jaccardNgrams(a, b) {
        const matched = [];
        let intersection = 0;
        let union = 0;
        const allKeys = new Set([...a.keys(), ...b.keys()]);
        for (const key of allKeys) {
            const countA = a.get(key) ?? 0;
            const countB = b.get(key) ?? 0;
            intersection += Math.min(countA, countB);
            union += Math.max(countA, countB);
            if (countA > 0 && countB > 0) {
                matched.push(key);
            }
        }
        return { score: union === 0 ? 0 : intersection / union, matched };
    }
};
exports.NgramService = NgramService;
exports.NgramService = NgramService = __decorate([
    (0, common_1.Injectable)()
], NgramService);
//# sourceMappingURL=ngram.service.js.map