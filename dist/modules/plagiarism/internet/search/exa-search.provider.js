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
var ExaSearchProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExaSearchProvider = void 0;
const common_1 = require("@nestjs/common");
const plagiarism_config_1 = require("../../utils/plagiarism.config");
let ExaSearchProvider = ExaSearchProvider_1 = class ExaSearchProvider {
    constructor(config) {
        this.config = config;
        this.name = 'exa';
        this.logger = new common_1.Logger(ExaSearchProvider_1.name);
    }
    async search(query, maxResults) {
        if (!this.config.exaApiKey) {
            this.logger.warn('EXA_API_KEY not configured — skipping Exa search');
            return [];
        }
        const response = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'x-api-key': this.config.exaApiKey,
            },
            body: JSON.stringify({
                query,
                numResults: maxResults,
                contents: {
                    text: true,
                },
            }),
            signal: AbortSignal.timeout(this.config.fetchTimeoutMs),
        });
        if (!response.ok) {
            throw new Error(`Exa search HTTP ${response.status}`);
        }
        const data = (await response.json());
        this.logger.debug(`Exa search returned ${data.results?.length ?? 0} results`);
        return (data.results ?? []).slice(0, maxResults).map((result) => ({
            title: result.title,
            url: result.url,
            snippet: result.text,
        }));
    }
};
exports.ExaSearchProvider = ExaSearchProvider;
exports.ExaSearchProvider = ExaSearchProvider = ExaSearchProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [plagiarism_config_1.PlagiarismConfig])
], ExaSearchProvider);
//# sourceMappingURL=exa-search.provider.js.map