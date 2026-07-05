"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var InternetSourceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternetSourceService = void 0;
const common_1 = require("@nestjs/common");
const FETCH_TIMEOUT_MS = 8_000;
let InternetSourceService = InternetSourceService_1 = class InternetSourceService {
    constructor() {
        this.logger = new common_1.Logger(InternetSourceService_1.name);
    }
    async loadFromUrls(urls) {
        const documents = [];
        for (const url of urls) {
            try {
                const content = await this.fetchPageText(url);
                if (content.length < 50)
                    continue;
                documents.push({
                    id: url,
                    entityType: 'WebPage',
                    title: this.extractTitleFromUrl(url),
                    content,
                    sourceType: 'internet',
                    sourceUrl: url,
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                this.logger.warn(`Failed to fetch URL ${url}: ${message}`);
            }
        }
        return documents;
    }
    async fetchPageText(url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: { 'User-Agent': 'Beleqet-PlagiarismScout/1.0' },
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const html = await response.text();
            return this.stripHtml(html);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    stripHtml(html) {
        return html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/\s+/g, ' ')
            .trim();
    }
    extractTitleFromUrl(url) {
        try {
            const parsed = new URL(url);
            return parsed.hostname + parsed.pathname;
        }
        catch {
            return url;
        }
    }
};
exports.InternetSourceService = InternetSourceService;
exports.InternetSourceService = InternetSourceService = InternetSourceService_1 = __decorate([
    (0, common_1.Injectable)()
], InternetSourceService);
//# sourceMappingURL=internet-source.service.js.map