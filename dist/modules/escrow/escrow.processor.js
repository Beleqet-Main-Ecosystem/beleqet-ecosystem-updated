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
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const bullmq_2 = require("bullmq");
const bullmq_3 = require("@nestjs/bullmq");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
const queues_constants_1 = require("../queues/queues.constants");
const chapa_client_1 = require("../chapa/chapa.client");
const EscrowJobs = queues_constants_1.ESCROW_JOBS;
let EscrowProcessor = EscrowProcessor_1 = class EscrowProcessor extends bullmq_1.WorkerHost {
    constructor(prisma, config, chapaClient, notificationsQueue, escrowQueue) {
        super();
        this.prisma = prisma;
        this.config = config;
        this.chapaClient = chapaClient;
        this.notificationsQueue = notificationsQueue;
        this.escrowQueue = escrowQueue;
        this.logger = new common_1.Logger(EscrowProcessor_1.name);
    }
    async process(job) {
        switch (job.name) {
            case EscrowJobs.PROCESS_WEBHOOK:
                await this.handleWebhook(job);
                break;
            case EscrowJobs.AUTO_RELEASE:
                await this.handleAutoRelease(job);
                break;
            case EscrowJobs.UNLOCK_FUNDS:
                await this.handleUnlockFunds(job);
                break;
            default:
                this.logger.warn(`Unknown job execution path: ${job.name}`);
        }
    }
    async handleWebhook(job) {
        const txRef = String(job.data.tx_ref ?? job.data.trx_ref ?? job.data.reference ?? '');
        const reference = String(job.data.reference ?? txRef);
        const status = String(job.data.status ?? '');
        const eventName = String(job.data.event ?? job.data.type ?? 'payment');
        const eventKey = `${eventName}:${txRef}:${reference}:${status || 'no-status'}`;
        this.logger.log(`[escrow-webhook] txRef=${txRef} reference=${reference} status=${status}`);
        const alreadyProcessed = await this.prisma.eventLog.findFirst({
            where: { eventType: 'chapa.webhook.processed', entityId: eventKey },
        });
        if (alreadyProcessed) {
            this.logger.debug(`[escrow-webhook] Duplicate event skipped: ${eventKey}`);
            return;
        }
        const escrow = await this.prisma.escrowTransaction.findFirst({
            where: { OR: [{ gatewayRef: txRef }, { gatewayRef: reference }] },
            include: { freelanceJob: { include: { client: true } } },
        });
        if (!escrow) {
            this.logger.warn(`[escrow-webhook] No escrow found for txRef=${txRef || reference}`);
            return;
        }
        if (escrow.status === 'FUNDED') {
            await this.markWebhookProcessed(eventKey, escrow.id, job.data);
            this.logger.debug(`[escrow-webhook] Already funded, skipping`);
            return;
        }
        const isSuccessful = eventName === 'charge.success' || status.toLowerCase() === 'success';
        if (isSuccessful) {
            const providerTxRef = escrow.gatewayRef ?? txRef;
            const verified = await this.chapaClient.verifyTransaction(providerTxRef);
            const verifiedData = verified.data;
            const expectedChapaAmount = escrow.grossAmount - escrow.walletAppliedAmount;
            if (verifiedData?.status !== 'success' ||
                verifiedData.tx_ref !== providerTxRef ||
                verifiedData.currency !== escrow.currency ||
                !this.amountMatches(verifiedData.amount, expectedChapaAmount)) {
                throw new Error(`Chapa verification mismatch for escrow ${escrow.id}`);
            }
            const funded = await this.prisma.$transaction(async (tx) => {
                const claim = await tx.escrowTransaction.updateMany({
                    where: { id: escrow.id, status: { notIn: ['FUNDED', 'REFUNDED'] } },
                    data: {
                        status: 'FUNDED',
                        fundedAt: new Date(),
                        gatewayResponse: verified,
                    },
                });
                if (claim.count === 0) {
                    return false;
                }
                await tx.freelanceJob.update({
                    where: { id: escrow.freelanceJobId },
                    data: { status: 'FUNDED' },
                });
                if (escrow.walletAppliedAmount > 0) {
                    const wallet = await tx.employerWallet.findUnique({
                        where: { userId: escrow.freelanceJob.clientId },
                    });
                    if (wallet) {
                        await tx.employerWallet.update({
                            where: { id: wallet.id },
                            data: { lockedBalance: { decrement: escrow.walletAppliedAmount } },
                        });
                        await tx.employerWalletTransaction.create({
                            data: {
                                walletId: wallet.id,
                                type: 'DEBIT_WITHDRAWAL',
                                amount: escrow.walletAppliedAmount,
                                note: `Partially funded escrow for job ${escrow.freelanceJobId}`,
                                escrowId: escrow.id,
                            },
                        });
                    }
                }
                await tx.eventLog.create({
                    data: {
                        eventType: 'escrow.funded',
                        entityId: escrow.id,
                        entityType: 'EscrowTransaction',
                        payload: { amount: escrow.grossAmount, txRef: providerTxRef },
                        processedBy: EscrowProcessor_1.name,
                    },
                });
                await tx.eventLog.create({
                    data: {
                        eventType: 'chapa.webhook.processed',
                        entityId: eventKey,
                        entityType: 'EscrowTransaction',
                        payload: { escrowId: escrow.id, ...job.data },
                        processedBy: EscrowProcessor_1.name,
                    },
                });
                return true;
            });
            if (!funded) {
                this.logger.debug(`[escrow-webhook] Webhook lost race, already processed: ${eventKey}`);
                return;
            }
            await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_IN_APP, {
                userId: escrow.freelanceJob.clientId,
                type: 'escrow.funded',
                title: 'Escrow funded - your gig is now live',
                body: `${escrow.currency} ${escrow.grossAmount.toLocaleString()} has been secured.`,
                metadata: { escrowId: escrow.id, freelanceJobId: escrow.freelanceJobId },
            });
            this.logger.log(`[escrow-webhook] Escrow ${escrow.id} funded after Chapa verification`);
            return;
        }
        await this.prisma.escrowTransaction.update({
            where: { id: escrow.id },
            data: { gatewayResponse: job.data },
        });
        await this.markWebhookProcessed(eventKey, escrow.id, job.data);
        this.logger.warn(`[escrow-webhook] Payment failed for escrow ${escrow.id}`);
        if (escrow.walletAppliedAmount > 0) {
            await this.releaseLockedFunds(escrow.id, escrow.freelanceJob.clientId, escrow.walletAppliedAmount);
        }
    }
    async handleAutoRelease(job) {
        const { milestoneId, freelancerId, amount } = job.data;
        this.logger.log(`[auto-release] Processing milestone ${milestoneId} for freelancer ${freelancerId}`);
        const releaseAt = new Date(job.data.releaseAt);
        if (releaseAt > new Date()) {
            const delayMs = releaseAt.getTime() - Date.now();
            await this.escrowQueue.add(EscrowJobs.AUTO_RELEASE, job.data, {
                delay: delayMs,
                jobId: `auto-release:${milestoneId}`,
            });
            return;
        }
        const credited = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM "milestones" WHERE id = ${milestoneId} FOR UPDATE`;
            const alreadyCredited = await tx.eventLog.findFirst({
                where: { eventType: 'wallet.credited', entityId: milestoneId },
            });
            if (alreadyCredited) {
                return false;
            }
            const wallet = await tx.freelancerWallet.upsert({
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
            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'CREDIT_AVAILABLE',
                    amount,
                    note: 'Milestone payout cleared - 3-day hold complete',
                    milestoneId,
                },
            });
            await tx.eventLog.create({
                data: {
                    eventType: 'wallet.credited',
                    entityId: milestoneId,
                    entityType: 'Milestone',
                    payload: { milestoneId, freelancerId, amount },
                    processedBy: EscrowProcessor_1.name,
                },
            });
            return true;
        });
        if (!credited) {
            this.logger.debug(`[auto-release] Milestone ${milestoneId} already credited; skipping`);
            return;
        }
        await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_IN_APP, {
            userId: freelancerId,
            type: 'wallet.credited',
            title: `ETB ${amount.toLocaleString()} is now available`,
            body: 'Your hold period has cleared. You can now withdraw these funds.',
            metadata: { milestoneId, amount },
        });
        const user = await this.prisma.user.findUnique({ where: { id: freelancerId } });
        if (user?.telegramId) {
            await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_TELEGRAM, {
                telegramId: user.telegramId,
                message: `ETB ${amount.toLocaleString()} is now available in your Beleqet wallet. Withdraw at: ${this.config.get('FRONTEND_URL')}/freelance/wallet`,
            });
        }
        this.logger.log(`[auto-release] ETB ${amount} moved to available for freelancer ${freelancerId}`);
    }
    async handleUnlockFunds(job) {
        const { escrowId, clientId, amount } = job.data;
        this.logger.log(`[unlock-funds] Checking if escrow ${escrowId} needs unlocking for user ${clientId}`);
        await this.releaseLockedFunds(escrowId, clientId, amount);
    }
    async releaseLockedFunds(escrowId, clientId, amount) {
        const released = await this.prisma.$transaction(async (tx) => {
            const wallet = await tx.employerWallet.findUnique({ where: { userId: clientId } });
            if (!wallet)
                return false;
            const refundClaim = await tx.escrowTransaction.updateMany({
                where: { id: escrowId, status: { notIn: ['FUNDED', 'REFUNDED'] } },
                data: { status: 'REFUNDED' },
            });
            if (refundClaim.count === 0) {
                return false;
            }
            await tx.employerWallet.update({
                where: { id: wallet.id },
                data: {
                    lockedBalance: { decrement: amount },
                    balance: { increment: amount },
                },
            });
            await tx.employerWalletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'CREDIT_AVAILABLE',
                    amount,
                    note: `Refund for failed/abandoned escrow ${escrowId}`,
                    escrowId,
                },
            });
            return true;
        });
        if (!released)
            return;
        this.logger.log(`[unlock-funds] Released ETB ${amount} back to employer ${clientId} for abandoned escrow ${escrowId}`);
    }
    processedEventLog(eventKey, escrowId, payload) {
        return this.prisma.eventLog.create({
            data: {
                eventType: 'chapa.webhook.processed',
                entityId: eventKey,
                entityType: 'EscrowTransaction',
                payload: { escrowId, ...payload },
                processedBy: EscrowProcessor_1.name,
            },
        });
    }
    async markWebhookProcessed(eventKey, escrowId, payload) {
        await this.processedEventLog(eventKey, escrowId, payload);
    }
    amountMatches(providerAmount, expectedAmount) {
        const normalized = Number(providerAmount);
        return Number.isFinite(normalized) && Math.abs(normalized - expectedAmount) < 0.01;
    }
    handleJobFailure(job, error) {
        this.logger.error(`Job ${job?.id || 'unknown'} failed with error: ${error.message}`, error.stack);
    }
};
exports.EscrowProcessor = EscrowProcessor;
__decorate([
    (0, bullmq_1.OnWorkerEvent)('failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Error]),
    __metadata("design:returntype", void 0)
], EscrowProcessor.prototype, "handleJobFailure", null);
exports.EscrowProcessor = EscrowProcessor = EscrowProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bullmq_1.Processor)(queues_constants_1.QUEUE_NAMES.ESCROW),
    __param(3, (0, bullmq_3.InjectQueue)(queues_constants_1.QUEUE_NAMES.NOTIFICATIONS)),
    __param(4, (0, bullmq_3.InjectQueue)(queues_constants_1.QUEUE_NAMES.ESCROW)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        chapa_client_1.ChapaClient,
        bullmq_2.Queue,
        bullmq_2.Queue])
], EscrowProcessor);
//# sourceMappingURL=escrow.processor.js.map