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
var SearxngSearchProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearxngSearchProvider = void 0;
const common_1 = require("@nestjs/common");
const plagiarism_config_1 = require("../../utils/plagiarism.config");
let SearxngSearchProvider = SearxngSearchProvider_1 = class SearxngSearchProvider {
    constructor(config) {
        this.config = config;
        this.name = 'searxng';
        this.logger = new common_1.Logger(SearxngSearchProvider_1.name);
    }
    async search(query, maxResults) {
        if (!this.config.searxngUrl) {
            this.logger.warn('SEARXNG_URL not configured — skipping SearXNG search');
            return [];
        }
        const baseUrl = this.config.searxngUrl.replace(/\/$/, '');
        const url = new URL(`${baseUrl}/search`);
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'json');
        const response = await fetch(url.toString(), {
            headers: { Accept: 'application/json', 'User-Agent': 'Beleqet-PlagiarismScout/2.0' },
            signal: AbortSignal.timeout(this.config.fetchTimeoutMs),
        });
        if (!response.ok) {
            throw new Error(`SearXNG HTTP ${response.status}`);
        }
        const data = (await response.json());
        return (data.results ?? []).slice(0, maxResults).map((r) => ({
            title: r.title,
            url: r.url,
            snippet: r.content,
        }));
    }
};
exports.SearxngSearchProvider = SearxngSearchProvider;
exports.SearxngSearchProvider = SearxngSearchProvider = SearxngSearchProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [plagiarism_config_1.PlagiarismConfig])
], SearxngSearchProvider);
//# sourceMappingURL=searxng-search.provider.js.map