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
var EscrowProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscrowProcessor = void 0;
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const bull_2 = require("@nestjs/bull");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
const queues_constants_1 = require("../queues/queues.constants");
let EscrowProcessor = EscrowProcessor_1 = class EscrowProcessor {
    constructor(prisma, config, notificationsQueue) {
        this.prisma = prisma;
        this.config = config;
        this.notificationsQueue = notificationsQueue;
        this.logger = new common_1.Logger(EscrowProcessor_1.name);
    }
    async handleWebhook(job) {
        const { reference, status, tx_ref } = job.data;
        this.logger.log(`[escrow-webhook] ref=${reference} status=${status}`);
        const escrow = await this.prisma.escrowTransaction.findFirst({
            where: {
                OR: [
                    { gatewayRef: reference },
                    { gatewayRef: tx_ref },
                ],
            },
            include: {
                freelanceJob: { include: { client: true } },
            },
        });
        if (!escrow) {
            this.logger.warn(`[escrow-webhook] No escrow found for ref=${reference}`);
            return;
        }
        if (escrow.status === 'FUNDED') {
            this.logger.debug(`[escrow-webhook] Already funded, skipping`);
            return;
        }
        if (status === 'success' || status === 'SUCCESS') {
            const transactions = [
                this.prisma.escrowTransaction.update({
                    where: { id: escrow.id },
                    data: {
                        status: 'FUNDED',
                        fundedAt: new Date(),
                        gatewayResponse: job.data,
                    },
                }),
                this.prisma.freelanceJob.update({
                    where: { id: escrow.freelanceJobId },
                    data: { status: 'FUNDED' },
                }),
            ];
            if (escrow.walletAppliedAmount > 0) {
                const wallet = await this.prisma.employerWallet.findUnique({
                    where: { userId: escrow.freelanceJob.clientId }
                });
                if (wallet) {
                    transactions.push(this.prisma.employerWallet.update({
                        where: { id: wallet.id },
                        data: { lockedBalance: { decrement: escrow.walletAppliedAmount } }
                    }));
                    transactions.push(this.prisma.employerWalletTransaction.create({
                        data: {
                            walletId: wallet.id,
                            type: 'DEBIT_WITHDRAWAL',
                            amount: escrow.walletAppliedAmount,
                            note: `Partially funded escrow for job ${escrow.freelanceJobId}`,
                            escrowId: escrow.id,
                        }
                    }));
                }
            }
            transactions.push(this.prisma.eventLog.create({
                data: {
                    eventType: 'escrow.funded',
                    entityId: escrow.id,
                    entityType: 'EscrowTransaction',
                    payload: { amount: escrow.grossAmount },
                    processedBy: EscrowProcessor_1.name,
                },
            }));
            await this.prisma.$transaction(transactions);
            await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_IN_APP, {
                userId: escrow.freelanceJob.clientId,
                type: 'escrow.funded',
                title: '✅ Escrow funded — your gig is now live!',
                body: `ETB ${escrow.grossAmount.toLocaleString()} has been secured. Freelancers can now bid on your project.`,
                metadata: { escrowId: escrow.id, freelanceJobId: escrow.freelanceJobId },
            });
            this.logger.log(`[escrow-webhook] Escrow ${escrow.id} funded — gig published`);
        }
        else {
            await this.prisma.escrowTransaction.update({
                where: { id: escrow.id },
                data: { gatewayResponse: job.data },
            });
            this.logger.warn(`[escrow-webhook] Payment failed for escrow ${escrow.id}`);
        }
    }
    async handleAutoRelease(job) {
        const { milestoneId, freelancerId, amount } = job.data;
        this.logger.log(`[auto-release] Processing milestone ${milestoneId} for freelancer ${freelancerId}`);
        const releaseAt = new Date(job.data.releaseAt);
        if (releaseAt > new Date()) {
            const delayMs = releaseAt.getTime() - Date.now();
            await job.queue.add(queues_constants_1.ESCROW_JOBS.AUTO_RELEASE, job.data, { delay: delayMs });
            this.logger.debug(`[auto-release] Hold not elapsed, re-queued with ${delayMs}ms delay`);
            return;
        }
        const wallet = await this.prisma.freelancerWallet.upsert({
            where: { userId: freelancerId },
            update: {
                pendingBalance: { decrement: amount },
                availableBalance: { increment: amount },
            },
            create: {
                userId: freelancerId,
                pendingBalance: 0,
                availableBalance: amount,
            },
        });
        await this.prisma.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: 'CREDIT_AVAILABLE',
                amount,
                note: `Milestone payout cleared — 3-day hold complete`,
                milestoneId,
            },
        });
        await this.prisma.eventLog.create({
            data: {
                eventType: 'wallet.credited',
                entityId: milestoneId,
                entityType: 'Milestone',
                payload: { milestoneId, freelancerId, amount },
                processedBy: EscrowProcessor_1.name,
            },
        });
        await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_IN_APP, {
            userId: freelancerId,
            type: 'wallet.credited',
            title: `💰 ETB ${amount.toLocaleString()} is now available`,
            body: 'Your hold period has cleared. You can now withdraw these funds.',
            metadata: { milestoneId, amount },
        });
        const user = await this.prisma.user.findUnique({ where: { id: freelancerId } });
        if (user?.telegramId) {
            await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_TELEGRAM, {
                telegramId: user.telegramId,
                message: `💰 *ETB ${amount.toLocaleString()} is now available in your Beleqet wallet!*\n\nYour 3-day hold has cleared. Withdraw at: ${this.config.get('FRONTEND_URL')}/freelance/wallet`,
            });
        }
        this.logger.log(`[auto-release] ETB ${amount} moved to available for freelancer ${freelancerId}`);
    }
    async handleWithdrawal(job) {
        const { userId, amount, method } = job.data;
        this.logger.log(`[withdrawal] Processing ETB ${amount} via ${method} for user ${userId}`);
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
                        account_number: job.data.accountRef,
                        amount: amount.toString(),
                        currency: 'ETB',
                        reference: `withdrawal-${job.id}`,
                        bank_code: method === 'TELEBIRR' ? '855' : '853d0598-9c01-41ab-ac99-48eab4da1513',
                    }),
                });
                const data = await response.json();
                if (data.status !== 'success') {
                    this.logger.warn(`Chapa payout queue failed: ${data.message}`);
                }
            }
            catch (err) {
                this.logger.error(`Failed to reach Chapa payout queue: ${err.message}`);
            }
        }
        await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_IN_APP, {
            userId,
            type: 'wallet.withdrawal_processing',
            title: `Withdrawal of ETB ${amount.toLocaleString()} is processing`,
            body: `Your ${method} withdrawal is being processed. Funds typically arrive within 1–2 business days.`,
            metadata: { amount, method },
        });
        this.logger.log(`[withdrawal] ETB ${amount} payout initiated via ${method}`);
    }
    onFailed(job, error) {
        this.logger.error(`[escrow-queue] Job failed: [${job.name}] id=${job.id} attempt=${job.attemptsMade}`, error.stack);
    }
};
exports.EscrowProcessor = EscrowProcessor;
__decorate([
    (0, bull_1.Process)(queues_constants_1.ESCROW_JOBS.PROCESS_WEBHOOK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EscrowProcessor.prototype, "handleWebhook", null);
__decorate([
    (0, bull_1.Process)(queues_constants_1.ESCROW_JOBS.AUTO_RELEASE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EscrowProcessor.prototype, "handleAutoRelease", null);
__decorate([
    (0, bull_1.Process)(queues_constants_1.ESCROW_JOBS.PROCESS_WITHDRAWAL),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EscrowProcessor.prototype, "handleWithdrawal", null);
__decorate([
    (0, bull_1.OnQueueFailed)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Error]),
    __metadata("design:returntype", void 0)
], EscrowProcessor.prototype, "onFailed", null);
exports.EscrowProcessor = EscrowProcessor = EscrowProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)(queues_constants_1.QUEUE_NAMES.ESCROW),
    __param(2, (0, bull_2.InjectQueue)(queues_constants_1.QUEUE_NAMES.NOTIFICATIONS)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService, Object])
], EscrowProcessor);
//# sourceMappingURL=escrow.processor.js.map