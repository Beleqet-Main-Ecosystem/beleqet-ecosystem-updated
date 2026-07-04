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
var SearchIndexProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchIndexProcessor = void 0;
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const queues_constants_1 = require("../queues/queues.constants");
let SearchIndexProcessor = SearchIndexProcessor_1 = class SearchIndexProcessor {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(SearchIndexProcessor_1.name);
    }
    async indexJob(job) {
        const { action, entityType, entityId } = job.data;
        if (action === 'delete') {
            this.logger.debug(`[search-index] Delete ${entityType}:${entityId}`);
            return;
        }
        if (entityType === 'job') {
            const data = await this.prisma.job.findUnique({
                where: { id: entityId },
                include: { company: true, category: true },
            });
            if (!data)
                return;
            this.logger.debug(`[search-index] Indexed job:${entityId} "${data.title}"`);
        }
        if (entityType === 'freelance_job') {
            const data = await this.prisma.freelanceJob.findUnique({
                where: { id: entityId },
                include: { category: true },
            });
            if (!data)
                return;
            this.logger.debug(`[search-index] Indexed freelance_job:${entityId} "${data.title}"`);
        }
    }
};
exports.SearchIndexProcessor = SearchIndexProcessor;
__decorate([
    (0, bull_1.Process)('index-job'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SearchIndexProcessor.prototype, "indexJob", null);
exports.SearchIndexProcessor = SearchIndexProcessor = SearchIndexProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)(queues_constants_1.QUEUE_NAMES.SEARCH_INDEX),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SearchIndexProcessor);
//# sourceMappingURL=search-index.processor.js.map