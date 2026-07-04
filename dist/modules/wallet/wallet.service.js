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
var WalletService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = exports.WithdrawDto = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const prisma_service_1 = require("../../prisma/prisma.service");
const config_1 = require("@nestjs/config");
class WithdrawDto {
    constructor() {
        this.currency = 'ETB';
    }
}
exports.WithdrawDto = WithdrawDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1, { message: 'Minimum withdrawal is ETB 1' }),
    (0, class_validator_1.Max)(1_000_000, { message: 'Maximum single withdrawal is ETB 1,000,000' }),
    __metadata("design:type", Number)
], WithdrawDto.prototype, "amount", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(['CHAPA', 'TELEBIRR', 'CBE_BIRR'], { message: 'method must be CHAPA, TELEBIRR, or CBE_BIRR' }),
    __metadata("design:type", String)
], WithdrawDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50, { message: 'accountRef must be 50 characters or fewer' }),
    __metadata("design:type", String)
], WithdrawDto.prototype, "accountRef", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], WithdrawDto.prototype, "currency", void 0);
let WalletService = WalletService_1 = class WalletService {
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
        this.logger = new common_1.Logger(WalletService_1.name);
        this.exchangeRates = {
            'USD_ETB': 120.5,
            'EUR_ETB': 130.2,
            'ETB_USD': 1 / 120.5,
            'ETB_EUR': 1 / 130.2,
        };
    }
    async getEmployerWallet(userId) {
        let wallet = await this.prisma.employerWallet.findUnique({
            where: { userId },
            include: {
                transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
            },
        });
        if (!wallet) {
            wallet = await this.prisma.employerWallet.create({
                data: { userId, balance: 0, lockedBalance: 0 },
                include: { transactions: true },
            });
        }
        return wallet;
    }
    async getOrCreate(userId) {
        return this.prisma.freelancerWallet.upsert({
            where: { userId },
            update: {},
            create: { userId },
            include: { transactions: { orderBy: { createdAt: 'desc' }, take: 30 } },
        });
    }
    convertCurrency(amount, from, to) {
        if (from === to)
            return amount;
        const pair = `${from}_${to}`;
        const rate = this.exchangeRates[pair];
        if (!rate)
            throw new common_1.BadRequestException(`Exchange rate for ${from} to ${to} not found`);
        return Math.round(amount * rate);
    }
    async withdraw(userId, dto) {
        const wallet = await this.prisma.freelancerWallet.findUnique({ where: { userId } });
        if (!wallet)
            throw new common_1.NotFoundException('Wallet not found');
        const withdrawCurrency = dto.currency || 'ETB';
        const amountInWalletCurrency = this.convertCurrency(dto.amount, withdrawCurrency, wallet.currency);
        if (wallet.availableBalance < amountInWalletCurrency)
            throw new common_1.BadRequestException('Insufficient available balance');
        const { tx } = await this.prisma.$transaction(async (prisma) => {
            await prisma.freelancerWallet.update({
                where: { userId },
                data: { availableBalance: { decrement: amountInWalletCurrency } },
            });
            const tx = await prisma.walletTransaction.create({
                data: { walletId: wallet.id, type: 'DEBIT_WITHDRAWAL', amount: amountInWalletCurrency, note: `Withdrawal of ${dto.amount} ${withdrawCurrency} via ${dto.method} — pending` },
            });
            return { tx };
        });
        const chapaSecret = this.config.get('CHAPA_SECRET_KEY');
        if (chapaSecret) {
            try {
                const response = await fetch('https://api.chapa.co/v1/transfers', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${chapaSecret}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        account_name: 'Freelancer',
                        account_number: dto.accountRef,
                        amount: dto.amount.toString(),
                        currency: 'ETB',
                        reference: tx.id,
                        bank_code: dto.method === 'TELEBIRR' ? '855' : '853d0598-9c01-41ab-ac99-48eab4da1513',
                    }),
                });
                const data = await response.json();
                if (data.status !== 'success') {
                    this.logger.warn(`Chapa payout rejected: ${data.message}. Rolling back balance for user ${userId}`);
                    await this.prisma.$transaction([
                        this.prisma.freelancerWallet.update({
                            where: { userId },
                            data: { availableBalance: { increment: amountInWalletCurrency } },
                        }),
                        this.prisma.walletTransaction.update({
                            where: { id: tx.id },
                            data: { note: `Withdrawal via ${dto.method} — FAILED: ${data.message}` },
                        }),
                    ]);
                    throw new common_1.InternalServerErrorException(`Payout rejected by payment gateway: ${data.message}`);
                }
            }
            catch (err) {
                if (err instanceof common_1.InternalServerErrorException)
                    throw err;
                this.logger.error(`Failed to reach Chapa payout: ${err.message}. Rolling back.`);
                await this.prisma.$transaction([
                    this.prisma.freelancerWallet.update({
                        where: { userId },
                        data: { availableBalance: { increment: amountInWalletCurrency } },
                    }),
                    this.prisma.walletTransaction.update({
                        where: { id: tx.id },
                        data: { note: `Withdrawal via ${dto.method} — FAILED: network error` },
                    }),
                ]);
                throw new common_1.InternalServerErrorException('Could not reach payment gateway. Your balance has been restored.');
            }
        }
        return { success: true, amount: dto.amount, method: dto.method, note: 'Payout processing — typically 1-2 business days' };
    }
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = WalletService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], WalletService);
//# sourceMappingURL=wallet.service.js.map