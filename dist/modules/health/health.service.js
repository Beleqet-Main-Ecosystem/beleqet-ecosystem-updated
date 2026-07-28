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
var HealthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const redis_module_1 = require("../redis/redis.module");
let HealthService = HealthService_1 = class HealthService {
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    liveness() {
        return {
            status: 'ok',
            uptimeSeconds: Math.round(process.uptime()),
            timestamp: new Date().toISOString(),
        };
    }
    async readiness() {
        const [database, redis] = await Promise.all([
            this.probe(() => this.prisma.$queryRaw `SELECT 1`),
            this.probe(() => this.redis.ping()),
        ]);
        return {
            status: database.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded',
            checks: { database, redis },
        };
    }
    async probe(check) {
        const startedAt = Date.now();
        try {
            await this.withTimeout(check(), HealthService_1.PROBE_TIMEOUT_MS);
            return { status: 'up', latencyMs: Date.now() - startedAt };
        }
        catch {
            return { status: 'down', latencyMs: Date.now() - startedAt };
        }
    }
    withTimeout(promise, timeoutMs) {
        let timer;
        const timeout = new Promise((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error('health probe timeout')), timeoutMs);
        });
        return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
    }
};
exports.HealthService = HealthService;
HealthService.PROBE_TIMEOUT_MS = 2_000;
exports.HealthService = HealthService = HealthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(redis_module_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Function])
], HealthService);
//# sourceMappingURL=health.service.js.map