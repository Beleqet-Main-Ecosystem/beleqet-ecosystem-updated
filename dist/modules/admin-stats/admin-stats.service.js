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
exports.AdminStatsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const wallet_service_1 = require("../wallet/wallet.service");
const nestjs_i18n_1 = require("nestjs-i18n");
let AdminStatsService = class AdminStatsService {
    constructor(prisma, i18n, walletService) {
        this.prisma = prisma;
        this.i18n = i18n;
        this.walletService = walletService;
    }
    async getDashboardStats(query) {
        const targetCurrency = query.currency || 'ETB';
        const lang = query.lang || 'en';
        const totalUsers = await this.prisma.user.count({
            where: { isActive: true },
        });
        const activeContracts = await this.prisma.contract.count({
            where: { status: 'ACTIVE' },
        });
        const completedJobs = await this.prisma.freelanceJob.count({
            where: { status: 'COMPLETED' },
        });
        const escrowTransactions = await this.prisma.escrowTransaction.findMany({
            where: { status: 'RELEASED' },
            select: { netAmount: true, currency: true },
        });
        let totalRevenue = 0;
        for (const tx of escrowTransactions) {
            const amount = tx.netAmount || 0;
            const currency = tx.currency || 'ETB';
            try {
                totalRevenue += this.walletService.convertCurrency(amount, currency, targetCurrency);
            }
            catch (error) {
                totalRevenue += amount;
            }
        }
        const translatedMessage = this.i18n.t('admin-stats.DASHBOARD_TITLE', {
            lang,
            defaultValue: 'Dashboard Statistics',
        });
        return {
            totalUsers,
            totalRevenue,
            activeContracts,
            completedJobs,
            currency: targetCurrency,
            message: typeof translatedMessage === 'string' ? translatedMessage : 'Dashboard Statistics',
        };
    }
};
exports.AdminStatsService = AdminStatsService;
exports.AdminStatsService = AdminStatsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        nestjs_i18n_1.I18nService,
        wallet_service_1.WalletService])
], AdminStatsService);
//# sourceMappingURL=admin-stats.service.js.map