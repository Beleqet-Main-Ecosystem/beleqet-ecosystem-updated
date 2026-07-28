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
var InternetSourceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternetSourceService = void 0;
const common_1 = require("@nestjs/common");
const promises_1 = require("dns/promises");
const net_1 = require("net");
const plagiarism_config_1 = require("../utils/plagiarism.config");
const keyword_extractor_service_1 = require("./keyword-extractor.service");
const web_search_service_1 = require("./search/web-search.service");
let InternetSourceService = InternetSourceService_1 = class InternetSourceService {
    constructor(config, keywordExtractor, webSearch) {
        this.config = config;
        this.keywordExtractor = keywordExtractor;
        this.webSearch = webSearch;
        this.logger = new common_1.Logger(InternetSourceService_1.name);
    }
    async loadFromSearch(inputText) {
        if (!this.config.enableWebSearch) {
            this.logger.debug('Web search disabled — skipping internet sources');
            return [];
        }
        const query = this.keywordExtractor.extractQuery(inputText);
        this.logger.debug(`Web search query: "${query}"`);
        const searchResults = await this.webSearch.search(query);
        this.logger.debug(`Web search returned ${searchResults.length} results`);
        const urls = searchResults.map((r) => r.url);
        return this.loadFromUrls(urls, searchResults);
    }
    async loadFromUrls(urls, searchMeta) {
        const metaByUrl = new Map((searchMeta ?? []).map((r) => [r.url, r]));
        const uniqueUrls = [...new Set(urls)].slice(0, this.config.maxWebResults);
        const documents = [];
        await Promise.all(uniqueUrls.map(async (url) => {
            try {
                const content = await this.fetchPageText(url);
                if (content.length < 50)
                    return;
                const meta = metaByUrl.get(url);
                documents.push({
                    id: url,
                    entityType: 'WebPage',
                    title: meta?.title ?? this.extractTitleFromUrl(url),
                    content,
                    sourceType: 'internet',
                    sourceUrl: url,
                });
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                this.logger.warn(`Failed to fetch URL ${url}: ${message}`);
            }
        }));
        return documents;
    }
    async fetchPageText(url) {
        const parsedUrl = new URL(url);
        const resolvedAddresses = await this.validateFetchUrl(parsedUrl);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.fetchTimeoutMs);
        try {
            const html = await this.fetchHtmlByIp(parsedUrl, resolvedAddresses[0], controller.signal);
            return this.stripHtml(html);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async fetchHtmlByIp(parsedUrl, ip, signal) {
        const isHttps = parsedUrl.protocol === 'https:';
        const httpModule = isHttps ? await Promise.resolve().then(() => require('https')) : await Promise.resolve().then(() => require('http'));
        const port = parsedUrl.port || (isHttps ? '443' : '80');
        return new Promise((resolve, reject) => {
            const request = httpModule.request({
                protocol: parsedUrl.protocol,
                hostname: ip,
                port,
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers: {
                    Host: parsedUrl.host,
                    'User-Agent': 'Beleqet-PlagiarismScout/2.0',
                },
                signal,
                ...(isHttps ? { servername: parsedUrl.hostname } : {}),
            }, (response) => {
                if (response.statusCode && response.statusCode >= 400) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    response.resume();
                    return;
                }
                let body = '';
                response.setEncoding('utf8');
                response.on('data', (chunk) => {
                    body += chunk;
                });
                response.on('end', () => resolve(body));
            });
            request.on('error', reject);
            request.end();
        });
    }
    stripHtml(html) {
        return html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&#?\w+;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    async validateFetchUrl(parsedUrl) {
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new Error('Only http:// and https:// URLs are allowed for internet sources');
        }
        const hostname = parsedUrl.hostname.toLowerCase();
        if (hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '::1' ||
            hostname === '0.0.0.0') {
            throw new Error('URL points to a local or private host');
        }
        const addresses = await (0, promises_1.lookup)(hostname, { all: true });
        if (addresses.length === 0) {
            throw new Error('Unable to resolve URL hostname');
        }
        const resolvedAddresses = addresses.map((address) => address.address);
        for (const address of resolvedAddresses) {
            if (this.isPrivateIp(address)) {
                throw new Error('URL resolves to a private or local IP address');
            }
        }
        return resolvedAddresses;
    }
    isPrivateIp(ip) {
        if (ip === '::1' || ip === '0.0.0.0')
            return true;
        if (ip.startsWith('::ffff:')) {
            ip = ip.substring(7);
        }
        const version = (0, net_1.isIP)(ip);
        if (version === 4) {
            const [octet1, octet2] = ip.split('.').map(Number);
            return (octet1 === 10 ||
                (octet1 === 172 && octet2 >= 16 && octet2 <= 31) ||
                (octet1 === 192 && octet2 === 168) ||
                (octet1 === 169 && octet2 === 254) ||
                octet1 === 127);
        }
        if (version === 6) {
            return ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80') || ip === '::1';
        }
        return false;
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
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [plagiarism_config_1.PlagiarismConfig,
        keyword_extractor_service_1.KeywordExtractorService,
        web_search_service_1.WebSearchService])
], InternetSourceService);
//# sourceMappingURL=internet-source.service.js.map