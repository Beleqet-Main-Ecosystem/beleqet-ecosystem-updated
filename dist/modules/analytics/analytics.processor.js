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
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const queues_constants_1 = require("../queues/queues.constants");
let AnalyticsProcessor = AnalyticsProcessor_1 = class AnalyticsProcessor extends bullmq_1.WorkerHost {
    constructor(prisma) {
        super();
        this.prisma = prisma;
        this.logger = new common_1.Logger(AnalyticsProcessor_1.name);
    }
    async process(job) {
        switch (job.name) {
            case queues_constants_1.ANALYTICS_JOBS.LOG_EVENT:
                await this.prisma.eventLog.create({
                    data: {
                        eventType: job.data.eventType,
                        entityId: String(job.data.jobId ?? job.data.applicationId ?? 'global'),
                        entityType: 'Analytics',
                        payload: job.data,
                        processedBy: AnalyticsProcessor_1.name,
                    },
                });
                break;
            case queues_constants_1.ANALYTICS_JOBS.UPDATE_JOB_STATS:
                const count = await this.prisma.application.count({ where: { jobId: job.data.jobId } });
                this.logger.debug(`Job ${job.data.jobId} now has ${count} applications`);
                break;
            default:
                this.logger.warn(`Unknown job name: ${job.name} on analytics queue`);
        }
    }
};
exports.AnalyticsProcessor = AnalyticsProcessor;
exports.AnalyticsProcessor = AnalyticsProcessor = AnalyticsProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bullmq_1.Processor)(queues_constants_1.QUEUE_NAMES.ANALYTICS),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AnalyticsProcessor);
//# sourceMappingURL=analytics.processor.js.map