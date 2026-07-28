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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AiBudgetService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiBudgetService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const redis_module_1 = require("../redis/redis.module");
let AiBudgetService = AiBudgetService_1 = class AiBudgetService {
    constructor(redis, config) {
        this.redis = redis;
        this.config = config;
        this.logger = new common_1.Logger(AiBudgetService_1.name);
    }
    async assertWithinBudget(userId) {
        if (!userId)
            return;
        const { requestBudget, tokenBudget } = this.limits();
        let requests;
        let tokens;
        try {
            [requests, tokens] = await this.readCounters(userId);
        }
        catch (err) {
            this.logger.warn(`AI budget check skipped (Redis unavailable): ${err.message}`);
            return;
        }
        if (requests >= requestBudget) {
            throw new common_1.HttpException(`Daily resume AI limit reached (${requestBudget} extractions/day). ` +
                'Please try again tomorrow.', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        if (tokens >= tokenBudget) {
            throw new common_1.HttpException('Daily resume AI usage limit reached. Please try again tomorrow.', common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
    }
    async recordUsage(userId, usage) {
        if (!userId)
            return;
        const window = this.windowSeconds();
        try {
            await this.incrementWithWindow(this.requestKey(userId), 1, window);
            const tokens = Math.max(0, Math.floor(usage?.totalTokens ?? 0));
            if (tokens > 0) {
                await this.incrementWithWindow(this.tokenKey(userId), tokens, window);
            }
        }
        catch (err) {
            this.logger.warn(`Failed to record AI usage for user ${userId}: ${err.message}`);
        }
    }
    async incrementWithWindow(key, by, window) {
        const pipeline = this.redis.pipeline();
        if (by === 1) {
            pipeline.incr(key);
        }
        else {
            pipeline.incrby(key, by);
        }
        pipeline.ttl(key);
        const results = await pipeline.exec();
        for (const [err] of results ?? []) {
            if (err)
                throw err;
        }
        const ttl = Number(results?.[1]?.[1] ?? -1);
        if (ttl < 0) {
            await this.redis.expire(key, window);
        }
    }
    async readCounters(userId) {
        const [req, tok] = await this.redis.mget(this.requestKey(userId), this.tokenKey(userId));
        return [this.toCount(req), this.toCount(tok)];
    }
    toCount(value) {
        const n = Number(value ?? 0);
        return Number.isFinite(n) ? n : 0;
    }
    limits() {
        return {
            requestBudget: this.config.get('RESUME_AI_DAILY_REQUEST_BUDGET', 50),
            tokenBudget: this.config.get('RESUME_AI_DAILY_TOKEN_BUDGET', 100_000),
        };
    }
    windowSeconds() {
        return this.config.get('RESUME_AI_BUDGET_WINDOW_SECONDS', 86_400);
    }
    requestKey(userId) {
        return `resume-brain:budget:req:${userId}`;
    }
    tokenKey(userId) {
        return `resume-brain:budget:tok:${userId}`;
    }
};
exports.AiBudgetService = AiBudgetService;
exports.AiBudgetService = AiBudgetService = AiBudgetService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_module_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [Function, config_1.ConfigService])
], AiBudgetService);
//# sourceMappingURL=ai-budget.service.js.map