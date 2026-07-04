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
exports.FreelanceService = exports.CreateMilestoneDto = exports.CreateBidDto = exports.CreateFreelanceJobDto = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateFreelanceJobDto {
}
exports.CreateFreelanceJobDto = CreateFreelanceJobDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Build a Modern E-commerce Website' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFreelanceJobDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'I need an experienced freelance developer...' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFreelanceJobDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'f05b2516-f887-4f58-b44b-791f6c93f396' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFreelanceJobDto.prototype, "categoryId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 15000 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateFreelanceJobDto.prototype, "budgetMin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 30000 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateFreelanceJobDto.prototype, "budgetMax", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'FIXED', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFreelanceJobDto.prototype, "pricingType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 30 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateFreelanceJobDto.prototype, "deadlineDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: ['Next.js', 'React'] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateFreelanceJobDto.prototype, "skills", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Addis Ababa', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFreelanceJobDto.prototype, "locationPreference", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Intermediate', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateFreelanceJobDto.prototype, "experienceLevel", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: [], required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateFreelanceJobDto.prototype, "attachments", void 0);
class CreateBidDto {
}
exports.CreateBidDto = CreateBidDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 20000 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateBidDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 25 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateBidDto.prototype, "timelineDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'I have successfully completed similar projects...' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBidDto.prototype, "coverLetter", void 0);
class CreateMilestoneDto {
}
exports.CreateMilestoneDto = CreateMilestoneDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Initial Design' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMilestoneDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Figma mockups for the homepage', required: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMilestoneDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 10000 }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateMilestoneDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-07-10T00:00:00.000Z' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateMilestoneDto.prototype, "deadline", void 0);
let FreelanceService = class FreelanceService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createJob(clientId, dto) {
        return this.prisma.freelanceJob.create({
            data: { ...dto, clientId, status: 'OPEN' },
            include: { category: true, client: { select: { id: true, firstName: true, lastName: true } } },
        });
    }
    async findJobs(query) {
        const pageNum = Number(query.page) || 1;
        const limitNum = Number(query.limit) || 20;
        const { q, category } = query;
        const where = { status: { in: ['OPEN', 'FUNDED'] } };
        if (category)
            where['category'] = { slug: category };
        if (q)
            where['OR'] = [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
            ];
        const [items, total] = await Promise.all([
            this.prisma.freelanceJob.findMany({
                where: where,
                include: { category: true, _count: { select: { bids: true } } },
                orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
            }),
            this.prisma.freelanceJob.count({ where: where }),
        ]);
        return { items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
    }
    async findJobById(id) {
        const job = await this.prisma.freelanceJob.findUnique({
            where: { id },
            include: {
                category: true,
                client: { select: { id: true, firstName: true, lastName: true } },
                bids: {
                    include: { freelancer: { select: { id: true, firstName: true, lastName: true } } },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!job)
            throw new common_1.NotFoundException('Gig not found');
        return job;
    }
    async submitBid(freelancerId, gigId, dto) {
        const gig = await this.prisma.freelanceJob.findFirst({
            where: { id: gigId, status: { in: ['OPEN', 'FUNDED'] } },
        });
        if (!gig)
            throw new common_1.NotFoundException('Gig not found or no longer accepting bids');
        const existing = await this.prisma.bid.findUnique({
            where: { freelanceJobId_freelancerId: { freelanceJobId: gigId, freelancerId } },
        });
        if (existing)
            throw new common_1.ConflictException('You have already submitted a bid');
        return this.prisma.bid.create({ data: { ...dto, freelanceJobId: gigId, freelancerId } });
    }
    async acceptBid(bidId, clientId) {
        const bid = await this.prisma.bid.findFirst({
            where: { id: bidId, freelanceJob: { clientId } },
        });
        if (!bid)
            throw new common_1.NotFoundException('Bid not found');
        const contract = await this.prisma.$transaction(async (tx) => {
            await tx.bid.update({ where: { id: bidId }, data: { status: 'ACCEPTED' } });
            await tx.bid.updateMany({
                where: { freelanceJobId: bid.freelanceJobId, id: { not: bidId } },
                data: { status: 'REJECTED' },
            });
            const c = await tx.contract.create({
                data: { freelanceJobId: bid.freelanceJobId, clientId, freelancerId: bid.freelancerId, agreedAmount: bid.amount },
            });
            await tx.freelanceJob.update({
                where: { id: bid.freelanceJobId },
                data: { status: 'IN_PROGRESS' },
            });
            const escrow = await tx.escrowTransaction.findFirst({
                where: { freelanceJobId: bid.freelanceJobId, status: { in: ['FUNDED', 'PENDING'] } }
            });
            if (escrow && escrow.grossAmount > bid.amount) {
                const excess = escrow.grossAmount - bid.amount;
                const wallet = await tx.employerWallet.upsert({
                    where: { userId: clientId },
                    update: { balance: { increment: excess } },
                    create: { userId: clientId, balance: excess, lockedBalance: 0 }
                });
                await tx.employerWalletTransaction.create({
                    data: {
                        walletId: wallet.id,
                        type: 'CREDIT_AVAILABLE',
                        amount: excess,
                        note: `Refund for excess escrow on gig ${bid.freelanceJobId}`,
                        escrowId: escrow.id,
                    }
                });
                const platformFeePct = 0.10;
                const platformFee = Math.round(bid.amount * platformFeePct);
                const netAmount = bid.amount - platformFee;
                await tx.escrowTransaction.update({
                    where: { id: escrow.id },
                    data: {
                        grossAmount: bid.amount,
                        platformFee,
                        netAmount
                    }
                });
            }
            await tx.chatRoom.create({
                data: {
                    contractId: c.id,
                    participants: { create: [{ userId: clientId }, { userId: bid.freelancerId }] },
                },
            });
            return c;
        });
        return contract;
    }
    async rejectBid(bidId, clientId) {
        const bid = await this.prisma.bid.findFirst({
            where: { id: bidId, freelanceJob: { clientId } },
        });
        if (!bid)
            throw new common_1.NotFoundException('Bid not found');
        return this.prisma.bid.update({
            where: { id: bidId },
            data: { status: 'REJECTED' },
        });
    }
    async getMyBids(freelancerId) {
        return this.prisma.bid.findMany({
            where: { freelancerId },
            include: { freelanceJob: { include: { category: true, contract: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getMyContracts(userId) {
        return this.prisma.contract.findMany({
            where: {
                OR: [
                    { clientId: userId },
                    { freelancerId: userId }
                ]
            },
            include: {
                freelanceJob: true,
                client: { select: { id: true, firstName: true, lastName: true } },
                freelancer: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { startedAt: 'desc' },
        });
    }
    async getContract(id) {
        const c = await this.prisma.contract.findUnique({
            where: { id },
            include: {
                milestones: { include: { deliverables: true } },
                freelanceJob: true,
                client: { select: { id: true, firstName: true, lastName: true } },
                freelancer: { select: { id: true, firstName: true, lastName: true } },
            },
        });
        if (!c)
            throw new common_1.NotFoundException('Contract not found');
        return c;
    }
    async createMilestone(freelancerId, contractId, dto) {
        const contract = await this.prisma.contract.findFirst({
            where: { id: contractId, freelancerId },
        });
        if (!contract) {
            throw new common_1.ForbiddenException('Contract not found or you are not authorized to add milestones to it');
        }
        return this.prisma.milestone.create({
            data: {
                ...dto,
                contractId,
                deadline: new Date(dto.deadline),
            },
        });
    }
};
exports.FreelanceService = FreelanceService;
exports.FreelanceService = FreelanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FreelanceService);
//# sourceMappingURL=freelance.service.js.map