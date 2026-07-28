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
var DuckDuckGoSearchProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuckDuckGoSearchProvider = void 0;
const common_1 = require("@nestjs/common");
const plagiarism_config_1 = require("../../utils/plagiarism.config");
let DuckDuckGoSearchProvider = DuckDuckGoSearchProvider_1 = class DuckDuckGoSearchProvider {
    constructor(config) {
        this.config = config;
        this.name = 'duckduckgo';
        this.logger = new common_1.Logger(DuckDuckGoSearchProvider_1.name);
    }
    async search(query, maxResults) {
        try {
            const body = new URLSearchParams({ q: query });
            const response = await fetch('https://lite.duckduckgo.com/lite/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Beleqet-PlagiarismScout/2.0',
                },
                body: body.toString(),
                signal: AbortSignal.timeout(this.config.fetchTimeoutMs),
            });
            if (!response.ok) {
                throw new Error(`DuckDuckGo HTTP ${response.status}`);
            }
            const html = await response.text();
            return this.parseResults(html, maxResults);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`DuckDuckGo search failed: ${message}`);
            return [];
        }
    }
    parseResults(html, maxResults) {
        const results = [];
        const linkRegex = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
        let match;
        while ((match = linkRegex.exec(html)) !== null && results.length < maxResults) {
            const rawUrl = match[1];
            const title = this.decodeHtml(match[2].trim());
            const url = this.resolveUrl(rawUrl);
            if (url.startsWith('http')) {
                results.push({ title, url });
            }
        }
        if (results.length === 0) {
            const fallbackRegex = /uddg=([^&"]+)/g;
            const titleRegex = /<td[^>]*><b>([^<]+)<\/b>/g;
            const urls = [];
            let urlMatch;
            while ((urlMatch = fallbackRegex.exec(html)) !== null && urls.length < maxResults) {
                try {
                    urls.push(decodeURIComponent(urlMatch[1]));
                }
                catch {
                }
            }
            const titles = [];
            let titleMatch;
            while ((titleMatch = titleRegex.exec(html)) !== null && titles.length < maxResults) {
                titles.push(this.decodeHtml(titleMatch[1].trim()));
            }
            for (let i = 0; i < Math.min(urls.length, maxResults); i++) {
                results.push({ title: titles[i] ?? urls[i], url: urls[i] });
            }
        }
        return results;
    }
    resolveUrl(raw) {
        if (raw.startsWith('http'))
            return raw;
        if (raw.includes('uddg=')) {
            const match = raw.match(/uddg=([^&]+)/);
            if (match) {
                try {
                    return decodeURIComponent(match[1]);
                }
                catch {
                    return raw;
                }
            }
        }
        return raw;
    }
    decodeHtml(text) {
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    }
};
exports.DuckDuckGoSearchProvider = DuckDuckGoSearchProvider;
exports.DuckDuckGoSearchProvider = DuckDuckGoSearchProvider = DuckDuckGoSearchProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [plagiarism_config_1.PlagiarismConfig])
], DuckDuckGoSearchProvider);
//# sourceMappingURL=duckduckgo-search.provider.js.map