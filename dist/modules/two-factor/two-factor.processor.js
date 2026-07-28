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
var TwoFactorProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwoFactorProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const two_factor_service_1 = require("./two-factor.service");
const queues_constants_1 = require("../queues/queues.constants");
let TwoFactorProcessor = TwoFactorProcessor_1 = class TwoFactorProcessor extends bullmq_1.WorkerHost {
    constructor(twoFactorService) {
        super();
        this.twoFactorService = twoFactorService;
        this.logger = new common_1.Logger(TwoFactorProcessor_1.name);
    }
    async process(job) {
        switch (job.name) {
            case queues_constants_1.TWO_FACTOR_JOBS.CLEANUP_EXPIRED_ENROLLMENT:
                return await this.handleCleanup(job);
            default:
                this.logger.warn(`Unknown job name: ${job.name} on 'scheduled' queue`);
                return null;
        }
    }
    async handleCleanup(job) {
        this.logger.log(`Processing cleanup job ${job.id}`);
        const count = await this.twoFactorService.cleanupExpiredEnrollments();
        this.logger.log(`Cleanup complete: ${count} expired enrollments removed`);
        return count;
    }
};
exports.TwoFactorProcessor = TwoFactorProcessor;
exports.TwoFactorProcessor = TwoFactorProcessor = TwoFactorProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('scheduled'),
    __metadata("design:paramtypes", [two_factor_service_1.TwoFactorService])
], TwoFactorProcessor);
//# sourceMappingURL=two-factor.processor.js.map