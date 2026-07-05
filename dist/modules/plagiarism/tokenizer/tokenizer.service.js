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
let TokenizerService = class TokenizerService {
    tokenize(text) {
        const normalized = text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter((word) => word.length > 2 && !stop_words_1.STOP_WORDS.has(word));
        return normalized;
    }
};
exports.TokenizerService = TokenizerService;
exports.TokenizerService = TokenizerService = __decorate([
    (0, common_1.Injectable)()
], TokenizerService);
//# sourceMappingURL=tokenizer.service.js.map