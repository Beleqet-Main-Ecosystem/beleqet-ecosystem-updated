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
exports.JaccardStrategy = void 0;
const common_1 = require("@nestjs/common");
const tokenizer_service_1 = require("../tokenizer/tokenizer.service");
let JaccardStrategy = class JaccardStrategy {
    constructor(tokenizer) {
        this.tokenizer = tokenizer;
    }
    compare(textA, textB) {
        const tokensA = new Set(this.tokenizer.tokenize(textA));
        const tokensB = new Set(this.tokenizer.tokenize(textB));
        if (tokensA.size === 0 && tokensB.size === 0) {
            return { score: 0, matchedTokens: [] };
        }
        const intersection = [];
        for (const token of tokensA) {
            if (tokensB.has(token)) {
                intersection.push(token);
            }
        }
        const unionSize = new Set([...tokensA, ...tokensB]).size;
        const score = unionSize === 0 ? 0 : intersection.length / unionSize;
        return { score, matchedTokens: intersection };
    }
};
exports.JaccardStrategy = JaccardStrategy;
exports.JaccardStrategy = JaccardStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tokenizer_service_1.TokenizerService])
], JaccardStrategy);
//# sourceMappingURL=jaccard.strategy.js.map