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
var EscrowService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscrowService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_1 = require("../../prisma/prisma.service");
const queues_constants_1 = require("../queues/queues.constants");
const wallet_service_1 = require("../wallet/wallet.service");
const chapa_client_1 = require("../chapa/chapa.client");
const escrow_state_1 = require("./escrow-state");
const PLATFORM_FEE_PCT = 0.1;
const MILESTONE_HOLD_MS = 3 * 24 * 60 * 60 * 1000;
const ESCROW_REINIT_BLOCKING_STATUSES = ['FUNDED', 'IN_REVIEW', 'RELEASED', 'DISPUTED'];
let EscrowService = EscrowService_1 = class EscrowService {
    constructor(prisma, config, walletSvc, chapaClient, escrowQueue, eventEmitter) {
        this.prisma = prisma;
        this.config = config;
        this.walletSvc = walletSvc;
        this.chapaClient = chapaClient;
        this.escrowQueue = escrowQueue;
        this.eventEmitter = eventEmitter;
        this.logger = new common_1.Logger(EscrowService_1.name);
    }
    async initiate(clientId, freelanceJobId) {
        const job = await this.prisma.freelanceJob.findFirst({
            where: { id: freelanceJobId, clientId },
            include: { client: true, contract: true },
        });
        if (!job)
            throw new common_1.NotFoundException('Gig not found');
        const grossAmount = job.contract ? job.contract.agreedAmount : job.budgetMax;
        if (!job.contract) {
            this.logger.warn(`Escrow initiated without a contract for job ${freelanceJobId}; using budgetMax.`);
        }
        const platformFee = Math.round(grossAmount * PLATFORM_FEE_PCT);
        const netAmount = grossAmount - platformFee;
        const txRef = `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const funding = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM "freelance_jobs" WHERE id = ${freelanceJobId} FOR UPDATE`;
            const existingEscrow = await tx.escrowTransaction.findUnique({
                where: { freelanceJobId },
            });
            if (existingEscrow) {
                if (ESCROW_REINIT_BLOCKING_STATUSES.includes(existingEscrow.status)) {
                    throw new common_1.ConflictException('Escrow is already funded or active for this gig.');
                }
                if (existingEscrow.status === 'PENDING') {
                    return {
                        escrow: existingEscrow,
                        amountToPay: Math.max(0, existingEscrow.grossAmount - existingEscrow.walletAppliedAmount),
                        walletAppliedAmount: existingEscrow.walletAppliedAmount,
                        platformFee: existingEscrow.platformFee,
                        netAmount: existingEscrow.netAmount,
                        existingPending: true,
                        fundedFromWallet: false,
                    };
                }
            }
            const employerWallet = await tx.employerWallet.findUnique({
                where: { userId: clientId },
            });
            const availableBalance = employerWallet?.balance || 0;
            let amountToPay = grossAmount;
            let walletAppliedAmount = 0;
            if (availableBalance > 0) {
                walletAppliedAmount = Math.min(availableBalance, grossAmount);
                amountToPay = grossAmount - walletAppliedAmount;
                const updateResult = await tx.employerWallet.updateMany({
                    where: { userId: clientId, balance: { gte: walletAppliedAmount } },
                    data: {
                        balance: { decrement: walletAppliedAmount },
                        lockedBalance: { increment: walletAppliedAmount },
                    },
                });
                if (updateResult.count === 0) {
                    throw new common_1.BadRequestException('Insufficient balance or concurrent transaction');
                }
            }
            const escrowData = {
                grossAmount,
                platformFee,
                netAmount,
                walletAppliedAmount,
                currency: job.currency,
                status: amountToPay === 0 ? 'FUNDED' : 'PENDING',
                gatewayRef: txRef,
            };
            const escrow = existingEscrow?.status === 'REFUNDED'
                ? await tx.escrowTransaction.update({
                    where: { id: existingEscrow.id },
                    data: escrowData,
                })
                : await tx.escrowTransaction.create({
                    data: {
                        freelanceJobId,
                        ...escrowData,
                    },
                });
            if (amountToPay === 0) {
                if (!employerWallet) {
                    throw new common_1.BadRequestException('Employer wallet is required for wallet funding.');
                }
                await tx.employerWalletTransaction.create({
                    data: {
                        walletId: employerWallet.id,
                        type: 'DEBIT_WITHDRAWAL',
                        amount: walletAppliedAmount,
                        note: `Fully funded escrow for job ${freelanceJobId}`,
                        escrowId: escrow.id,
                    },
                });
                await tx.employerWallet.update({
                    where: { userId: clientId },
                    data: { lockedBalance: { decrement: walletAppliedAmount } },
                });
                await tx.freelanceJob.update({
                    where: { id: freelanceJobId },
                    data: { status: 'FUNDED' },
                });
                await tx.eventLog.create({
                    data: {
                        eventType: 'escrow.funded',
                        entityId: escrow.id,
                        entityType: 'EscrowTransaction',
                        payload: { amount: grossAmount, walletAppliedAmount, source: 'employer_wallet' },
                        processedBy: EscrowService_1.name,
                    },
                });
            }
            return {
                escrow,
                amountToPay,
                walletAppliedAmount,
                platformFee,
                netAmount,
                existingPending: false,
                fundedFromWallet: amountToPay === 0,
            };
        });
        const { escrow, amountToPay, walletAppliedAmount, existingPending, fundedFromWallet } = funding;
        if (existingPending) {
            const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3000';
            const checkoutUrl = amountToPay > 0 ? `${frontendUrl}/freelance/pay?escrow=${escrow.id}` : null;
            this.logger.debug(`Escrow ${escrow.id} is already pending; returning existing funding state`);
            return {
                escrowId: escrow.id,
                checkoutUrl,
                grossAmount: escrow.grossAmount,
                platformFee: funding.platformFee,
                netAmount: funding.netAmount,
                walletAppliedAmount,
                amountToPay,
            };
        }
        if (walletAppliedAmount > 0 && amountToPay > 0) {
            await this.escrowQueue.add(queues_constants_1.ESCROW_JOBS.UNLOCK_FUNDS, { escrowId: escrow.id, clientId, amount: walletAppliedAmount }, { delay: 24 * 60 * 60 * 1000, jobId: `unlock-funds:${escrow.id}` });
        }
        if (fundedFromWallet) {
            this.eventEmitter.emit('payment.escrow.funded', {
                escrowId: escrow.id,
                clientId,
                grossAmount: escrow.grossAmount,
                currency: job.currency,
                source: 'employer_wallet',
                timestamp: new Date().toISOString(),
            });
            return {
                escrowId: escrow.id,
                checkoutUrl: null,
                grossAmount: escrow.grossAmount,
                platformFee: funding.platformFee,
                netAmount: funding.netAmount,
                walletAppliedAmount,
                amountToPay,
            };
        }
        const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3000';
        let checkoutUrl = `${frontendUrl}/freelance/pay?escrow=${escrow.id}`;
        if (this.config.get('CHAPA_SECRET_KEY')) {
            try {
                const data = await this.chapaClient.initializePayment({
                    amount: amountToPay.toString(),
                    currency: job.currency,
                    email: job.client.email,
                    firstName: job.client.firstName,
                    lastName: job.client.lastName,
                    txRef,
                    callbackUrl: this.config.get('CHAPA_CALLBACK_URL'),
                    returnUrl: this.config.get('CHAPA_RETURN_URL'),
                    title: 'Beleqet Escrow',
                    description: `Payment for Gig - ${job.title}`
                        .replace(/[^a-zA-Z0-9\-_.\s]/g, '')
                        .substring(0, 50),
                });
                checkoutUrl = data.data?.checkout_url ?? checkoutUrl;
            }
            catch (err) {
                this.logger.error(`Failed to initialize Chapa checkout: ${err.message}`);
            }
        }
        this.eventEmitter.emit('payment.escrow.initiated', {
            escrowId: escrow.id,
            clientId,
            grossAmount: escrow.grossAmount,
            currency: job.currency,
            timestamp: new Date().toISOString(),
        });
        return {
            escrowId: escrow.id,
            checkoutUrl,
            grossAmount: escrow.grossAmount,
            platformFee: funding.platformFee,
            netAmount: funding.netAmount,
            walletAppliedAmount,
            amountToPay,
        };
    }
    async handleWebhook(payload) {
        const txRef = String(payload.tx_ref ?? payload.trx_ref ?? payload.reference ?? 'unknown');
        const eventKey = [
            payload.event ?? payload.type ?? 'payment',
            txRef,
            payload.reference ?? 'no-provider-reference',
            payload.status ?? 'no-status',
        ].join(':');
        await this.escrowQueue.add(queues_constants_1.ESCROW_JOBS.PROCESS_WEBHOOK, payload, { jobId: eventKey });
        return { queued: true, eventKey };
    }
    async confirmMilestone(milestoneId, userId, _dto = {}) {
        void _dto;
        return this.recordMilestoneConfirmation(milestoneId, userId);
    }
    async releaseMilestone(milestoneId, clientId) {
        return this.recordMilestoneConfirmation(milestoneId, clientId, 'EMPLOYER');
    }
    async recordMilestoneConfirmation(milestoneId, userId, requiredActor) {
        const { actor, updated } = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM "milestones" WHERE id = ${milestoneId} FOR UPDATE`;
            const milestone = await tx.milestone.findFirst({
                where: {
                    id: milestoneId,
                    contract: { OR: [{ clientId: userId }, { freelancerId: userId }] },
                },
                include: { contract: { include: { freelanceJob: { include: { escrowTx: true } } } } },
            });
            if (!milestone)
                throw new common_1.NotFoundException('Milestone not found');
            const escrow = milestone.contract.freelanceJob.escrowTx;
            if (!escrow || escrow.status !== 'FUNDED') {
                throw new common_1.ConflictException('Escrow must be funded before milestone confirmation.');
            }
            const actor = milestone.contract.clientId === userId ? 'EMPLOYER' : 'FREELANCER';
            if (requiredActor && actor !== requiredActor) {
                throw new common_1.NotFoundException('Milestone not found');
            }
            const confirmedAt = new Date();
            const confirmationData = actor === 'EMPLOYER'
                ? { employerApprovedAt: milestone.employerApprovedAt ?? confirmedAt }
                : { freelancerApprovedAt: milestone.freelancerApprovedAt ?? confirmedAt };
            const updated = await tx.milestone.update({
                where: { id: milestoneId },
                data: confirmationData,
                include: { contract: { include: { freelanceJob: { include: { escrowTx: true } } } } },
            });
            await tx.eventLog.create({
                data: {
                    eventType: 'milestone.confirmed',
                    entityId: milestoneId,
                    entityType: 'Milestone',
                    payload: { actor, userId, milestoneId },
                    processedBy: EscrowService_1.name,
                },
            });
            return { actor, updated };
        });
        if (!(0, escrow_state_1.isMilestoneFullyConfirmed)(updated)) {
            return {
                success: true,
                released: false,
                waitingFor: actor === 'EMPLOYER' ? 'FREELANCER' : 'EMPLOYER',
            };
        }
        return this.queueMilestoneRelease(updated);
    }
    async queueMilestoneRelease(milestone) {
        const netAmountInETB = this.netMilestoneAmountInETB(milestone);
        if (milestone.status === 'APPROVED') {
            await this.enqueueMilestoneAutoRelease(milestone, netAmountInETB, milestone.approvedAt ?? new Date());
            return { success: true, released: true, alreadyReleased: true };
        }
        if (!(0, escrow_state_1.isMilestoneFullyConfirmed)(milestone)) {
            throw new common_1.ForbiddenException('Both employer and professional must confirm milestone completion.');
        }
        const approvedAt = new Date();
        const claimedApproval = await this.prisma.$transaction(async (tx) => {
            const approval = await tx.milestone.updateMany({
                where: { id: milestone.id, status: { not: 'APPROVED' } },
                data: { status: 'APPROVED', approvedAt },
            });
            if (approval.count === 0) {
                return false;
            }
            const wallet = await tx.freelancerWallet.upsert({
                where: { userId: milestone.contract.freelancerId },
                update: { pendingBalance: { increment: netAmountInETB } },
                create: {
                    userId: milestone.contract.freelancerId,
                    pendingBalance: netAmountInETB,
                    availableBalance: 0,
                },
            });
            await tx.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: 'CREDIT_PENDING',
                    amount: netAmountInETB,
                    note: `Milestone ${milestone.id} approved - pending hold`,
                    milestoneId: milestone.id,
                },
            });
            await tx.eventLog.create({
                data: {
                    eventType: 'milestone.approved',
                    entityId: milestone.id,
                    entityType: 'Milestone',
                    payload: {
                        milestoneId: milestone.id,
                        freelancerId: milestone.contract.freelancerId,
                        amount: milestone.amount,
                    },
                    processedBy: EscrowService_1.name,
                },
            });
            return true;
        });
        if (!claimedApproval) {
            await this.enqueueMilestoneAutoRelease(milestone, netAmountInETB, milestone.approvedAt ?? approvedAt);
            return { success: true, released: true, alreadyReleased: true };
        }
        await this.enqueueMilestoneAutoRelease(milestone, netAmountInETB, approvedAt);
        this.logger.log(`Milestone ${milestone.id} approved after both confirmations; payout queued`);
        return { success: true, released: true };
    }
    netMilestoneAmountInETB(milestone) {
        const contractCurrency = milestone.contract.currency || 'ETB';
        const grossAmountInETB = this.walletSvc.convertCurrency(milestone.amount, contractCurrency, 'ETB');
        const platformFee = Math.round(grossAmountInETB * PLATFORM_FEE_PCT);
        return grossAmountInETB - platformFee;
    }
    async enqueueMilestoneAutoRelease(milestone, amount, approvedAt) {
        const releaseAt = new Date(approvedAt.getTime() + MILESTONE_HOLD_MS);
        const delay = Math.max(0, releaseAt.getTime() - Date.now());
        await this.escrowQueue.add(queues_constants_1.ESCROW_JOBS.AUTO_RELEASE, {
            milestoneId: milestone.id,
            freelancerId: milestone.contract.freelancerId,
            amount,
            releaseAt,
        }, {
            delay,
            jobId: `auto-release:${milestone.id}`,
        });
    }
};
exports.EscrowService = EscrowService;
exports.EscrowService = EscrowService = EscrowService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, bullmq_1.InjectQueue)(queues_constants_1.QUEUE_NAMES.ESCROW)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        wallet_service_1.WalletService,
        chapa_client_1.ChapaClient,
        bullmq_2.Queue,
        event_emitter_1.EventEmitter2])
], EscrowService);
//# sourceMappingURL=escrow.service.js.map