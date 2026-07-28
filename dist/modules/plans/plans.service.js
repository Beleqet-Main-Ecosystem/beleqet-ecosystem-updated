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
exports.PlansService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
let PlansService = class PlansService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll(includeInactive = false) {
        return this.prisma.plan.findMany({
            where: includeInactive ? {} : { isActive: true },
            orderBy: { priceAmount: 'asc' },
        });
    }
    async findOne(id) {
        const plan = await this.prisma.plan.findUnique({ where: { id } });
        if (!plan)
            throw new common_1.NotFoundException('Plan not found');
        return plan;
    }
    async create(dto) {
        try {
            return await this.prisma.plan.create({
                data: {
                    name: dto.name,
                    description: dto.description,
                    priceAmount: dto.priceAmount,
                    currency: dto.currency ?? 'ETB',
                    interval: dto.interval,
                    features: dto.features,
                    isActive: dto.isActive ?? true,
                    paypalPlanId: dto.paypalPlanId,
                },
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new common_1.ConflictException(`A plan named "${dto.name}" already exists`);
            }
            throw err;
        }
    }
    async update(id, dto) {
        await this.findOne(id);
        return this.prisma.plan.update({
            where: { id },
            data: {
                ...dto,
                features: dto.features ? dto.features : undefined,
            },
        });
    }
    async remove(id) {
        await this.findOne(id);
        return this.prisma.plan.update({ where: { id }, data: { isActive: false } });
    }
};
exports.PlansService = PlansService;
exports.PlansService = PlansService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PlansService);
//# sourceMappingURL=plans.service.js.map