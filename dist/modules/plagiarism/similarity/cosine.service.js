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
exports.CosineService = void 0;
const common_1 = require("@nestjs/common");
const tokenizer_service_1 = require("../tokenizer/tokenizer.service");
const math_utils_1 = require("../utils/math.utils");
let CosineService = class CosineService {
    constructor(tokenizer) {
        this.tokenizer = tokenizer;
        this.name = 'cosine';
    }
    compare(textA, textB) {
        const tokensA = this.tokenizer.tokenizeCached(textA);
        const tokensB = this.tokenizer.tokenizeCached(textB);
        if (tokensA.length === 0 || tokensB.length === 0) {
            return { score: 0, matchedTokens: [] };
        }
        const tfA = (0, math_utils_1.termFrequency)(tokensA);
        const tfB = (0, math_utils_1.termFrequency)(tokensB);
        const vocabulary = [...new Set([...tfA.keys(), ...tfB.keys()])].sort();
        const vectorA = (0, math_utils_1.tfToVector)(tfA, vocabulary);
        const vectorB = (0, math_utils_1.tfToVector)(tfB, vocabulary);
        const idf = this.computeIdf([tfA, tfB], vocabulary);
        const weightedA = vectorA.map((v, i) => v * idf[i]);
        const weightedB = vectorB.map((v, i) => v * idf[i]);
        const score = (0, math_utils_1.cosineSimilarity)(weightedA, weightedB);
        const matchedTokens = vocabulary.filter((term) => tfA.has(term) && tfB.has(term));
        return { score, matchedTokens };
    }
    computeIdf(docs, vocabulary) {
        const docCount = docs.length;
        return vocabulary.map((term) => {
            const docsWithTerm = docs.filter((doc) => doc.has(term)).length;
            return Math.log((docCount + 1) / (docsWithTerm + 1)) + 1;
        });
    }
};
exports.CosineService = CosineService;
exports.CosineService = CosineService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tokenizer_service_1.TokenizerService])
], CosineService);
//# sourceMappingURL=cosine.service.js.map