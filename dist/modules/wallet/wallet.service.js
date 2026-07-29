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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var WalletService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = exports.WithdrawDto = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const class_validator_1 = require("class-validator");
const prisma_service_1 = require("../../prisma/prisma.service");
const queues_constants_1 = require("../queues/queues.constants");
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
    (0, class_validator_1.IsEnum)(['CHAPA', 'TELEBIRR', 'CBE_BIRR'], {
        message: 'method must be CHAPA, TELEBIRR, or CBE_BIRR',
    }),
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
    constructor(prisma, walletQueue) {
        this.prisma = prisma;
        this.walletQueue = walletQueue;
        this.logger = new common_1.Logger(WalletService_1.name);
        this.exchangeRates = {
            USD: 1,
            EUR: 120.5 / 130.2,
            ETB: 120.5,
        };
    }
    async onModuleInit() {
        if (process.env.NODE_ENV === 'test') {
            return;
        }
        await this.fetchLiveRates();
        this.fetchInterval = setInterval(() => this.fetchLiveRates(), 6 * 60 * 60 * 1000);
        if (this.fetchInterval.unref) {
            this.fetchInterval.unref();
        }
    }
    onModuleDestroy() {
        if (this.fetchInterval) {
            clearInterval(this.fetchInterval);
        }
    }
    async fetchLiveRates() {
        try {
            const response = await fetch('https://open.er-api.com/v6/latest/USD');
            if (!response.ok) {
                throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);
            }
            const data = await response.json();
            if (data && data.rates) {
                this.exchangeRates = data.rates;
                this.logger.log('Live exchange rates updated successfully');
            }
        }
        catch (error) {
            this.logger.error('Error fetching live exchange rates. Falling back to cached rates.', error);
        }
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
        const rateFrom = this.exchangeRates[from];
        const rateTo = this.exchangeRates[to];
        if (!rateFrom || !rateTo) {
            throw new common_1.BadRequestException(`Exchange rate for ${from} to ${to} not found`);
        }
        const rate = rateTo / rateFrom;
        return Math.round(amount * rate);
    }
    async withdraw(userId, dto) {
        const wallet = await this.prisma.freelancerWallet.findUnique({ where: { userId } });
        if (!wallet)
            throw new common_1.NotFoundException('Wallet not found');
        const withdrawCurrency = dto.currency || 'ETB';
        const amountInWalletCurrency = this.convertCurrency(dto.amount, withdrawCurrency, wallet.currency);
        const amountInETB = this.convertCurrency(dto.amount, withdrawCurrency, 'ETB');
        if (wallet.availableBalance < amountInWalletCurrency)
            throw new common_1.BadRequestException('Insufficient available balance');
        const { tx } = await this.prisma.$transaction(async (prisma) => {
            const updateResult = await prisma.freelancerWallet.updateMany({
                where: {
                    userId,
                    availableBalance: { gte: amountInWalletCurrency },
                },
                data: { availableBalance: { decrement: amountInWalletCurrency } },
            });
            if (updateResult.count === 0) {
                throw new common_1.BadRequestException('Insufficient available balance');
            }
            const tx = await prisma.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'DEBIT_WITHDRAWAL',
                    amount: amountInWalletCurrency,
                    note: `WITHDRAWAL_PENDING - Withdrawal of ${dto.amount} ${withdrawCurrency} via ${dto.method} - pending Chapa payout of ETB ${amountInETB}`,
                },
            });
            return { tx };
        });
        if (!this.walletQueue) {
            await this.restoreFailedWithdrawal(userId, tx.id, amountInWalletCurrency, 'withdrawal queue unavailable');
            throw new common_1.InternalServerErrorException('Withdrawal queue is unavailable.');
        }
        try {
            await this.walletQueue.add(queues_constants_1.WALLET_JOBS.PROCESS_WITHDRAWAL, {
                withdrawalTxId: tx.id,
                userId,
                walletId: wallet.id,
                requestedAmount: dto.amount,
                requestedCurrency: withdrawCurrency,
                walletAmount: amountInWalletCurrency,
                payoutAmount: amountInETB,
                payoutCurrency: 'ETB',
                method: dto.method,
                accountRef: dto.accountRef,
            }, {
                jobId: `wallet-withdrawal:${tx.id}`,
                attempts: 5,
                backoff: { type: 'exponential', delay: 30_000 },
            });
        }
        catch (err) {
            this.logger.error(`Failed to enqueue Chapa payout: ${err.message}. Rolling back.`);
            await this.restoreFailedWithdrawal(userId, tx.id, amountInWalletCurrency, 'withdrawal queue unavailable');
            throw new common_1.InternalServerErrorException('Could not queue payout. Your balance has been restored.');
        }
        return {
            success: true,
            amount: dto.amount,
            amountInETB,
            method: dto.method,
            status: 'PENDING',
            note: 'Payout queued - typically 1-2 business days',
        };
    }
    async restoreFailedWithdrawal(userId, withdrawalTxId, amountInWalletCurrency, reason) {
        await this.prisma.$transaction([
            this.prisma.freelancerWallet.update({
                where: { userId },
                data: { availableBalance: { increment: amountInWalletCurrency } },
            }),
            this.prisma.walletTransaction.update({
                where: { id: withdrawalTxId },
                data: { note: `WITHDRAWAL_FAILED - Withdrawal FAILED: ${reason}` },
            }),
        ]);
    }
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = WalletService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, bullmq_1.InjectQueue)(queues_constants_1.QUEUE_NAMES.WALLET)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bullmq_2.Queue])
], WalletService);
//# sourceMappingURL=wallet.service.js.map