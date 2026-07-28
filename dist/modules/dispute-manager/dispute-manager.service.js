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
exports.DisputeManagerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const nestjs_i18n_1 = require("nestjs-i18n");
let DisputeManagerService = class DisputeManagerService {
    constructor(prisma, i18n) {
        this.prisma = prisma;
        this.i18n = i18n;
    }
    async createDispute(userId, createDisputeDto) {
        const contract = await this.prisma.contract.findUnique({
            where: { id: createDisputeDto.contractId },
        });
        if (!contract) {
            throw new common_1.NotFoundException('Contract not found');
        }
        if (contract.clientId !== userId && contract.freelancerId !== userId) {
            throw new common_1.BadRequestException('You are not authorized to raise a dispute for this contract');
        }
        const sanitizedReason = this.sanitizePii(createDisputeDto.reason);
        await this.prisma.contract.update({
            where: { id: contract.id },
            data: { status: 'DISPUTED' },
        });
        return this.prisma.dispute.create({
            data: {
                contractId: createDisputeDto.contractId,
                raisedById: userId,
                reason: sanitizedReason,
                evidenceUrls: createDisputeDto.evidenceUrls,
            },
        });
    }
    sanitizePii(text) {
        if (!text)
            return text;
        let sanitized = text.replace(/[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+/gi, '[REDACTED EMAIL]');
        sanitized = sanitized.replace(/(\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})/g, '[REDACTED PHONE]');
        return sanitized;
    }
    async resolveDispute(disputeId, resolveDto) {
        const dispute = await this.prisma.dispute.findUnique({
            where: { id: disputeId },
            include: { contract: true },
        });
        if (!dispute) {
            throw new common_1.NotFoundException('Dispute not found');
        }
        if (dispute.resolution) {
            throw new common_1.BadRequestException('Dispute is already resolved');
        }
        if (resolveDto.refundAmount && resolveDto.refundAmount > dispute.contract.agreedAmount) {
            throw new common_1.BadRequestException('Refund amount cannot exceed the contract agreed amount');
        }
        const updatedDispute = await this.prisma.dispute.update({
            where: { id: disputeId },
            data: {
                resolution: resolveDto.resolution,
                resolvedAt: new Date(),
            },
        });
        if (resolveDto.refundAmount && resolveDto.refundAmount > 0) {
            const employerWallet = await this.prisma.employerWallet.findUnique({
                where: { userId: dispute.contract.clientId },
            });
            if (employerWallet) {
                await this.prisma.$transaction([
                    this.prisma.employerWallet.update({
                        where: { id: employerWallet.id },
                        data: { balance: { increment: resolveDto.refundAmount } },
                    }),
                    this.prisma.employerWalletTransaction.create({
                        data: {
                            walletId: employerWallet.id,
                            type: 'CREDIT_AVAILABLE',
                            amount: resolveDto.refundAmount,
                            note: `Admin dispute resolution refund for contract ${dispute.contractId}`,
                        },
                    }),
                ]);
            }
        }
        const finalContractStatus = resolveDto.refundAmount && resolveDto.refundAmount > 0 ? 'CANCELLED' : 'COMPLETED';
        await this.prisma.contract.update({
            where: { id: dispute.contractId },
            data: { status: finalContractStatus },
        });
        const lang = resolveDto.lang || 'en';
        const message = this.i18n.t('dispute-manager.DISPUTE_RESOLVED', {
            lang,
            defaultValue: 'Dispute resolved successfully',
        });
        return {
            message: typeof message === 'string' ? message : 'Dispute resolved successfully',
            dispute: updatedDispute,
        };
    }
    async getAllDisputes() {
        return this.prisma.dispute.findMany({
            include: {
                contract: {
                    select: {
                        id: true,
                        status: true,
                        agreedAmount: true,
                        currency: true,
                    },
                },
            },
        });
    }
};
exports.DisputeManagerService = DisputeManagerService;
exports.DisputeManagerService = DisputeManagerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        nestjs_i18n_1.I18nService])
], DisputeManagerService);
//# sourceMappingURL=dispute-manager.service.js.map