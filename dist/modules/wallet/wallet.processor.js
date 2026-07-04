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
var WalletProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletProcessor = void 0;
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const queues_constants_1 = require("../queues/queues.constants");
let WalletProcessor = WalletProcessor_1 = class WalletProcessor {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(WalletProcessor_1.name);
    }
    async handleReleasePending(job) {
        const { walletId, userId, amount, milestoneId } = job.data;
        await this.prisma.freelancerWallet.update({
            where: { id: walletId },
            data: {
                pendingBalance: { decrement: amount },
                availableBalance: { increment: amount },
            },
        });
        await this.prisma.walletTransaction.create({
            data: {
                walletId,
                type: 'CREDIT_AVAILABLE',
                amount,
                note: 'Hold period cleared',
                milestoneId,
            },
        });
        this.logger.log(`[wallet] Released ETB ${amount} from pending → available for user ${userId}`);
    }
};
exports.WalletProcessor = WalletProcessor;
__decorate([
    (0, bull_1.Process)('release-pending'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WalletProcessor.prototype, "handleReleasePending", null);
exports.WalletProcessor = WalletProcessor = WalletProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)(queues_constants_1.QUEUE_NAMES.WALLET),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WalletProcessor);
//# sourceMappingURL=wallet.processor.js.map