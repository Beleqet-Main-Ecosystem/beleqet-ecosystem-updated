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
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
const queues_constants_1 = require("../queues/queues.constants");
const chapa_client_1 = require("../chapa/chapa.client");
const WITHDRAWAL_PENDING = 'WITHDRAWAL_PENDING';
const WITHDRAWAL_PROCESSING = 'WITHDRAWAL_PROCESSING';
const WITHDRAWAL_SUBMITTED = 'WITHDRAWAL_SUBMITTED';
const WITHDRAWAL_FAILED = 'WITHDRAWAL_FAILED';
const LEGACY_WITHDRAWAL_PENDING = 'pending Chapa payout';
const LEGACY_WITHDRAWAL_SUBMITTED = 'Chapa transfer submitted';
const LEGACY_WITHDRAWAL_FAILED = 'Withdrawal FAILED';
let WalletProcessor = WalletProcessor_1 = class WalletProcessor extends bullmq_1.WorkerHost {
    constructor(prisma, config, chapaClient) {
        super();
        this.prisma = prisma;
        this.config = config;
        this.chapaClient = chapaClient;
        this.logger = new common_1.Logger(WalletProcessor_1.name);
    }
    async process(job) {
        if (job.name === queues_constants_1.WALLET_JOBS.RELEASE_PENDING) {
            await this.releasePending(job);
            return;
        }
        if (job.name === queues_constants_1.WALLET_JOBS.PROCESS_WITHDRAWAL) {
            await this.processWithdrawal(job);
        }
    }
    async releasePending(job) {
        const { walletId, userId, amount, milestoneId } = job.data;
        const releaseKey = milestoneId ?? `wallet-release:${job.id ?? `${walletId}:${amount}`}`;
        const released = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM "freelancer_wallets" WHERE id = ${walletId} FOR UPDATE`;
            const alreadyReleased = await tx.eventLog.findFirst({
                where: { eventType: 'wallet.pending_released', entityId: releaseKey },
            });
            if (alreadyReleased) {
                return false;
            }
            await tx.freelancerWallet.update({
                where: { id: walletId },
                data: {
                    pendingBalance: { decrement: amount },
                    availableBalance: { increment: amount },
                },
            });
            await tx.walletTransaction.create({
                data: {
                    walletId,
                    type: 'CREDIT_AVAILABLE',
                    amount,
                    note: 'Hold period cleared',
                    milestoneId,
                },
            });
            await tx.eventLog.create({
                data: {
                    eventType: 'wallet.pending_released',
                    entityId: releaseKey,
                    entityType: 'FreelancerWallet',
                    payload: { walletId, userId, amount, milestoneId, jobId: job.id ?? null },
                    processedBy: WalletProcessor_1.name,
                },
            });
            return true;
        });
        if (!released) {
            this.logger.debug(`[wallet] Pending release ${releaseKey} already processed; skipping`);
            return;
        }
        this.logger.log(`[wallet] Released ETB ${amount} from pending to available for user ${userId}`);
    }
    async processWithdrawal(job) {
        const { withdrawalTxId, userId, walletAmount, payoutAmount, payoutCurrency, method, accountRef, } = job.data;
        if (!this.config.get('CHAPA_SECRET_KEY')) {
            const reason = `Chapa secret is not configured for withdrawal ${withdrawalTxId}`;
            this.logger.error(`[wallet] ${reason}`);
            throw new Error(reason);
        }
        const claim = await this.claimWithdrawalForProcessing(withdrawalTxId);
        if (claim.status === 'missing') {
            this.logger.warn(`[wallet] Withdrawal transaction ${withdrawalTxId} was not found`);
            return;
        }
        if (claim.status === 'finalized') {
            this.logger.debug(`[wallet] Withdrawal ${withdrawalTxId} already finalized; skipping`);
            return;
        }
        if (claim.status === 'processing') {
            const reconciled = await this.reconcileSubmittedWithdrawal(withdrawalTxId, method);
            if (reconciled)
                return;
            throw new Error(`Withdrawal ${withdrawalTxId} is already being processed; waiting for provider reconciliation`);
        }
        try {
            const result = await this.chapaClient.createTransfer({
                accountName: 'Freelancer',
                accountNumber: accountRef,
                amount: payoutAmount.toString(),
                currency: payoutCurrency,
                reference: withdrawalTxId,
                bankCode: method === 'TELEBIRR' ? '855' : '853d0598-9c01-41ab-ac99-48eab4da1513',
            });
            if (result.status !== 'success') {
                const reconciled = await this.reconcileSubmittedWithdrawal(withdrawalTxId, method);
                if (reconciled)
                    return;
                await this.restoreRejectedWithdrawal(userId, withdrawalTxId, walletAmount, result.message ?? 'Chapa rejected payout');
                return;
            }
            await this.markWithdrawalSubmitted(withdrawalTxId, method, result.data?.reference ?? withdrawalTxId);
            this.logger.log(`[wallet] Submitted withdrawal ${withdrawalTxId} for ETB ${payoutAmount} to Chapa`);
        }
        catch (err) {
            this.logger.error(`[wallet] Chapa transfer failed for withdrawal ${withdrawalTxId}: ${err.message}`);
            throw err;
        }
    }
    async claimWithdrawalForProcessing(withdrawalTxId) {
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM "wallet_transactions" WHERE id = ${withdrawalTxId} FOR UPDATE`;
            const withdrawal = await tx.walletTransaction.findUnique({
                where: { id: withdrawalTxId },
            });
            if (!withdrawal) {
                return { status: 'missing' };
            }
            const note = withdrawal.note ?? '';
            if (this.isWithdrawalFinalized(note)) {
                return { status: 'finalized' };
            }
            if (note.includes(WITHDRAWAL_PROCESSING)) {
                return { status: 'processing' };
            }
            await tx.walletTransaction.update({
                where: { id: withdrawalTxId },
                data: { note: this.processingNote(note) },
            });
            return { status: 'claimed' };
        });
    }
    async reconcileSubmittedWithdrawal(withdrawalTxId, method) {
        try {
            const verified = await this.chapaClient.verifyTransfer(withdrawalTxId);
            const providerStatus = String(verified.data?.status ?? verified.status ?? '').toLowerCase();
            if (providerStatus !== 'success') {
                return false;
            }
            await this.markWithdrawalSubmitted(withdrawalTxId, method, verified.data?.reference ?? withdrawalTxId);
            return true;
        }
        catch (err) {
            this.logger.warn(`[wallet] Could not verify transfer ${withdrawalTxId} before retry/refund: ${err.message}`);
            return false;
        }
    }
    async markWithdrawalSubmitted(withdrawalTxId, method, reference) {
        await this.prisma.walletTransaction.update({
            where: { id: withdrawalTxId },
            data: {
                note: `${WITHDRAWAL_SUBMITTED} - Withdrawal via ${method} - Chapa transfer submitted (${reference})`,
            },
        });
    }
    async restoreRejectedWithdrawal(userId, withdrawalTxId, walletAmount, reason) {
        await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM "wallet_transactions" WHERE id = ${withdrawalTxId} FOR UPDATE`;
            const withdrawal = await tx.walletTransaction.findUnique({
                where: { id: withdrawalTxId },
            });
            if (!withdrawal || this.isWithdrawalFinalized(withdrawal.note ?? '')) {
                this.logger.debug(`[wallet] Withdrawal ${withdrawalTxId} already finalized; skip refund`);
                return;
            }
            const note = withdrawal.note ?? '';
            if (!note.includes(WITHDRAWAL_PROCESSING) &&
                !note.includes(WITHDRAWAL_PENDING) &&
                !note.includes(LEGACY_WITHDRAWAL_PENDING)) {
                this.logger.warn(`[wallet] Withdrawal ${withdrawalTxId} is not in a refundable state; skip refund`);
                return;
            }
            await tx.walletTransaction.update({
                where: { id: withdrawalTxId },
                data: { note: `${WITHDRAWAL_FAILED} - Withdrawal FAILED: ${reason}` },
            });
            await tx.freelancerWallet.update({
                where: { userId },
                data: { availableBalance: { increment: walletAmount } },
            });
        });
    }
    processingNote(note) {
        return `${WITHDRAWAL_PROCESSING} - ${note || 'Withdrawal queued for Chapa payout'}`;
    }
    isWithdrawalFinalized(note) {
        return (note.includes(WITHDRAWAL_SUBMITTED) ||
            note.includes(WITHDRAWAL_FAILED) ||
            note.includes(LEGACY_WITHDRAWAL_SUBMITTED) ||
            note.includes(LEGACY_WITHDRAWAL_FAILED));
    }
};
exports.WalletProcessor = WalletProcessor;
exports.WalletProcessor = WalletProcessor = WalletProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bullmq_1.Processor)(queues_constants_1.QUEUE_NAMES.WALLET),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        chapa_client_1.ChapaClient])
], WalletProcessor);
//# sourceMappingURL=wallet.processor.js.map