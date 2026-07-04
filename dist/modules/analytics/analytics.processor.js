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
var AnalyticsProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsProcessor = void 0;
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const queues_constants_1 = require("../queues/queues.constants");
let AnalyticsProcessor = AnalyticsProcessor_1 = class AnalyticsProcessor {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(AnalyticsProcessor_1.name);
    }
    async logEvent(job) {
        await this.prisma.eventLog.create({
            data: {
                eventType: job.data.eventType,
                entityId: String(job.data.jobId ?? job.data.applicationId ?? 'global'),
                entityType: 'Analytics',
                payload: job.data,
                processedBy: AnalyticsProcessor_1.name,
            },
        });
    }
    async updateJobStats(job) {
        const count = await this.prisma.application.count({ where: { jobId: job.data.jobId } });
        this.logger.debug(`Job ${job.data.jobId} now has ${count} applications`);
    }
};
exports.AnalyticsProcessor = AnalyticsProcessor;
__decorate([
    (0, bull_1.Process)(queues_constants_1.ANALYTICS_JOBS.LOG_EVENT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnalyticsProcessor.prototype, "logEvent", null);
__decorate([
    (0, bull_1.Process)(queues_constants_1.ANALYTICS_JOBS.UPDATE_JOB_STATS),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnalyticsProcessor.prototype, "updateJobStats", null);
exports.AnalyticsProcessor = AnalyticsProcessor = AnalyticsProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)(queues_constants_1.QUEUE_NAMES.ANALYTICS),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AnalyticsProcessor);
//# sourceMappingURL=analytics.processor.js.map