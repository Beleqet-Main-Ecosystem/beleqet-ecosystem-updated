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
exports.AiFeedService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const SEARCH_HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const STOP_WORDS = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'for',
    'on',
    'at',
    'to',
    'in',
    'with',
    'without',
    'of',
    'by',
    'is',
    'are',
    'job',
    'jobs',
]);
const KEYWORD_MATCH_WEIGHT = 70;
const CATEGORY_AFFINITY_WEIGHT = 30;
const MAX_KEYWORDS = 12;
const KEYWORD_POOL_SIZE = 150;
const CATEGORY_POOL_SIZE = 50;
let AiFeedService = class AiFeedService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getPersonalizedFeed(userId, limit = 5) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { gdprConsent: true, skills: true },
        });
        if (!user?.gdprConsent) {
            return this.getGenericFeed(limit);
        }
        const [searchTerms, savedCategoryIds] = await Promise.all([
            this.getRecentSearchTerms(userId),
            this.getSavedJobCategoryIds(userId),
        ]);
        const keywords = this.extractKeywords([...searchTerms, ...(user.skills ?? [])]);
        if (keywords.length === 0 && savedCategoryIds.size === 0) {
            return this.getGenericFeed(limit);
        }
        const boundedKeywords = keywords.slice(0, MAX_KEYWORDS);
        const jobs = await this.fetchCandidatePool(boundedKeywords, savedCategoryIds);
        return this.rankJobs(jobs, boundedKeywords, savedCategoryIds).slice(0, limit);
    }
    async fetchCandidatePool(keywords, savedCategoryIds) {
        const [keywordJobs, categoryJobs] = await Promise.all([
            keywords.length > 0
                ? this.prisma.job.findMany({
                    where: { status: 'PUBLISHED', OR: this.buildKeywordFilter(keywords) },
                    orderBy: { createdAt: 'desc' },
                    take: KEYWORD_POOL_SIZE,
                    include: { company: true, category: true },
                })
                : Promise.resolve([]),
            savedCategoryIds.size > 0
                ? this.prisma.job.findMany({
                    where: { status: 'PUBLISHED', categoryId: { in: [...savedCategoryIds] } },
                    orderBy: { createdAt: 'desc' },
                    take: CATEGORY_POOL_SIZE,
                    include: { company: true, category: true },
                })
                : Promise.resolve([]),
        ]);
        const merged = new Map();
        for (const job of [...keywordJobs, ...categoryJobs]) {
            merged.set(job.id, job);
        }
        return [...merged.values()];
    }
    buildKeywordFilter(keywords) {
        const clauses = [];
        for (const keyword of keywords) {
            clauses.push({ title: { contains: keyword, mode: 'insensitive' } });
            clauses.push({ description: { contains: keyword, mode: 'insensitive' } });
        }
        clauses.push({ tags: { hasSome: keywords } });
        return clauses;
    }
    async getRecentSearchTerms(userId) {
        const history = await this.prisma.searchHistory.findMany({
            where: {
                userId,
                searchedAt: { gte: new Date(Date.now() - SEARCH_HISTORY_WINDOW_MS) },
            },
            select: { searchTerm: true },
        });
        return history.map((entry) => entry.searchTerm);
    }
    async getSavedJobCategoryIds(userId) {
        const saved = await this.prisma.savedJob.findMany({
            where: { userId },
            select: { job: { select: { categoryId: true } } },
        });
        return new Set(saved.map((entry) => entry.job.categoryId));
    }
    async getGenericFeed(limit) {
        const jobs = await this.prisma.job.findMany({
            where: { status: 'PUBLISHED' },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { company: true, category: true },
        });
        return jobs.map((job) => ({ ...job, relevanceScore: 0 }));
    }
    rankJobs(jobs, keywords, savedCategoryIds) {
        return jobs
            .map((job) => ({ ...job, relevanceScore: this.scoreJob(job, keywords, savedCategoryIds) }))
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    scoreJob(job, keywords, savedCategoryIds) {
        let score = 0;
        if (keywords.length > 0) {
            const tokens = this.tokenize(`${job.title} ${job.description} ${(job.tags ?? []).join(' ')}`);
            const matches = keywords.filter((keyword) => tokens.has(keyword)).length;
            score += (matches / keywords.length) * KEYWORD_MATCH_WEIGHT;
        }
        if (savedCategoryIds.has(job.categoryId)) {
            score += CATEGORY_AFFINITY_WEIGHT;
        }
        return Math.min(100, Math.round(score));
    }
    tokenize(text) {
        return new Set(text
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter(Boolean));
    }
    extractKeywords(terms) {
        const words = this.tokenize(terms.join(' '));
        return [...words].filter((word) => word.length > 2 && !STOP_WORDS.has(word));
    }
};
exports.AiFeedService = AiFeedService;
exports.AiFeedService = AiFeedService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AiFeedService);
//# sourceMappingURL=ai-feed.service.js.map