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
exports.HistoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const PLAGIARISM_EVENT_TYPE = 'PLAGIARISM_CHECK';
let HistoryService = class HistoryService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async save(result) {
        await this.prisma.eventLog.create({
            data: {
                eventType: PLAGIARISM_EVENT_TYPE,
                entityId: result.checkId,
                entityType: 'PlagiarismCheck',
                payload: result,
            },
        });
    }
    async findRecent(limit = 20) {
        const records = await this.prisma.eventLog.findMany({
            where: { eventType: PLAGIARISM_EVENT_TYPE },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        return records.map((record) => record.payload);
    }
    async findById(checkId) {
        const record = await this.prisma.eventLog.findFirst({
            where: {
                eventType: PLAGIARISM_EVENT_TYPE,
                entityId: checkId,
            },
        });
        if (!record) {
            throw new common_1.NotFoundException(`Plagiarism check ${checkId} not found`);
        }
        return record.payload;
    }
};
exports.HistoryService = HistoryService;
exports.HistoryService = HistoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HistoryService);
//# sourceMappingURL=history.service.js.map