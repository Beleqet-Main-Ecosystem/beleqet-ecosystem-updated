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
var WebSearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSearchService = void 0;
const common_1 = require("@nestjs/common");
const plagiarism_config_1 = require("../../utils/plagiarism.config");
const exa_search_provider_1 = require("./exa-search.provider");
const duckduckgo_search_provider_1 = require("./duckduckgo-search.provider");
const searxng_search_provider_1 = require("./searxng-search.provider");
let WebSearchService = WebSearchService_1 = class WebSearchService {
    constructor(config, exa, duckduckgo, searxng) {
        this.config = config;
        this.exa = exa;
        this.duckduckgo = duckduckgo;
        this.searxng = searxng;
        this.logger = new common_1.Logger(WebSearchService_1.name);
    }
    async search(query, maxResults) {
        const limit = maxResults ?? this.config.maxWebResults;
        const provider = this.resolveProvider();
        try {
            const results = await provider.search(query, limit);
            if (results.length > 0)
                return results;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`${provider.name} search failed: ${message}`);
        }
        if (provider.name !== 'duckduckgo') {
            this.logger.debug('Falling back to DuckDuckGo search');
            return this.duckduckgo.search(query, limit);
        }
        return [];
    }
    resolveProvider() {
        const map = {
            exa: this.exa,
            duckduckgo: this.duckduckgo,
            searxng: this.searxng,
        };
        return map[this.config.searchProvider] ?? this.duckduckgo;
    }
};
exports.WebSearchService = WebSearchService;
exports.WebSearchService = WebSearchService = WebSearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [plagiarism_config_1.PlagiarismConfig,
        exa_search_provider_1.ExaSearchProvider,
        duckduckgo_search_provider_1.DuckDuckGoSearchProvider,
        searxng_search_provider_1.SearxngSearchProvider])
], WebSearchService);
//# sourceMappingURL=web-search.service.js.map