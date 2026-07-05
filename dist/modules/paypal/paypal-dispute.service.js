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
var PaypalDisputeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaypalDisputeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
const bull_1 = require("@nestjs/bull");
const prisma_service_1 = require("../../prisma/prisma.service");
const paypal_auth_service_1 = require("./paypal-auth.service");
const queues_constants_1 = require("../queues/queues.constants");
const paypal_pii_utils_1 = require("./paypal-pii.utils");
let PaypalDisputeService = PaypalDisputeService_1 = class PaypalDisputeService {
    constructor(prisma, auth, config, paypalQueue) {
        this.prisma = prisma;
        this.auth = auth;
        this.config = config;
        this.paypalQueue = paypalQueue;
        this.logger = new common_1.Logger(PaypalDisputeService_1.name);
    }
    async refund(captureId, clientId, dto) {
        const tx = await this.prisma.paypalTransaction.findFirst({
            where: { paypalCaptureId: captureId, clientId },
        });
        if (!tx) {
            throw new common_1.NotFoundException(`No captured transaction found for captureId ${captureId} belonging to client ${clientId}`);
        }
        const mode = this.config.get('PAYPAL_MODE', 'sandbox');
        let refundId;
        let refundStatus;
        let rawResponse;
        if (mode === 'mock') {
            refundId = `MOCK-REF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            refundStatus = 'COMPLETED';
            rawResponse = { status: 'COMPLETED', simulated: true };
        }
        else {
            const token = await this.auth.getAccessToken();
            const baseUrl = this.auth.getBaseUrl();
            const body = {};
            if (dto.amount !== undefined) {
                body.amount = {
                    value: dto.amount.toFixed(2),
                    currency_code: dto.currency ?? tx.currency,
                };
            }
            if (dto.note) {
                body.note_to_payer = dto.note.substring(0, 255);
            }
            try {
                const response = await axios_1.default.post(`${baseUrl}/v2/payments/captures/${captureId}/refund`, body, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
                rawResponse = response.data;
                refundId = response.data.id;
                refundStatus = response.data.status;
            }
            catch (err) {
                const msg = axios_1.default.isAxiosError(err)
                    ? JSON.stringify(err.response?.data)
                    : String(err);
                this.logger.error(`Refund failed for captureId ${captureId}: ${msg}`);
                throw new common_1.BadRequestException(`PayPal refund failed: ${msg}`);
            }
        }
        const isPartial = dto.amount !== undefined;
        const newStatus = isPartial ? 'PARTIALLY_REFUNDED' : 'REFUNDED';
        await this.prisma.$transaction([
            this.prisma.paypalTransaction.update({
                where: { id: tx.id },
                data: {
                    status: newStatus,
                    refundedAmount: dto.amount ?? tx.amount,
                    refundNote: dto.note ?? null,
                    gatewayResponse: (0, paypal_pii_utils_1.sanitiseForStorage)(rawResponse),
                },
            }),
            this.prisma.paypalRefund.create({
                data: {
                    paypalRefundId: refundId,
                    transactionId: tx.id,
                    amount: dto.amount ?? Number(tx.amount),
                    currency: dto.currency ?? tx.currency,
                    refundStatus,
                    note: dto.note ?? null,
                    initiatedBy: clientId,
                    isPartial,
                    gatewayResponse: (0, paypal_pii_utils_1.sanitiseForStorage)(rawResponse),
                },
            }),
        ]);
        this.logger.log(`Refund ${refundId} (${refundStatus}) issued for capture ${captureId} — ${newStatus}`);
        return {
            transactionId: tx.id,
            captureId,
            refundId,
            refundStatus,
            newTxStatus: newStatus,
            refundedAmount: dto.amount ?? Number(tx.amount),
        };
    }
    async upsertDispute(payload) {
        const paypalDisputeId = payload.dispute_id;
        let transactionId = null;
        const buyerTxId = payload.dispute_transactions?.[0]?.buyer_transaction_id;
        if (buyerTxId) {
            const localTx = await this.prisma.paypalTransaction.findFirst({
                where: { paypalCaptureId: buyerTxId },
            });
            transactionId = localTx?.id ?? null;
        }
        const disputeStatus = this.mapDisputeStatus(payload.status);
        const record = await this.prisma.paypalDispute.upsert({
            where: { paypalDisputeId },
            update: {
                status: disputeStatus,
                outcome: payload.dispute_outcome?.outcome_code ?? null,
                resolvedAt: payload.update_time ? new Date(payload.update_time) : null,
                gatewayResponse: (0, paypal_pii_utils_1.sanitiseForStorage)(payload),
            },
            create: {
                paypalDisputeId,
                transactionId,
                reason: payload.reason ?? 'UNKNOWN',
                status: disputeStatus,
                openedAt: new Date(payload.create_time),
                resolvedAt: payload.update_time ? new Date(payload.update_time) : null,
                outcome: payload.dispute_outcome?.outcome_code ?? null,
                gatewayResponse: (0, paypal_pii_utils_1.sanitiseForStorage)(payload),
            },
        });
        this.logger.log(`Dispute ${paypalDisputeId} upserted — status: ${disputeStatus}`);
        await this.paypalQueue.add(queues_constants_1.PAYPAL_JOBS.SYNC_DISPUTE, { disputeId: paypalDisputeId, localId: record.id }, { delay: 5 * 60 * 1_000, attempts: 3, backoff: { type: 'exponential', delay: 10_000 } });
        return record;
    }
    mapDisputeStatus(paypalStatus) {
        const map = {
            OPEN: 'OPEN',
            WAITING_FOR_BUYER_RESPONSE: 'WAITING_FOR_BUYER_RESPONSE',
            WAITING_FOR_SELLER_RESPONSE: 'WAITING_FOR_SELLER_RESPONSE',
            UNDER_REVIEW: 'UNDER_REVIEW',
            RESOLVED: 'RESOLVED',
            CANCELLED: 'CANCELLED',
        };
        return map[paypalStatus] ?? 'OPEN';
    }
};
exports.PaypalDisputeService = PaypalDisputeService;
exports.PaypalDisputeService = PaypalDisputeService = PaypalDisputeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, bull_1.InjectQueue)(queues_constants_1.QUEUE_NAMES.PAYPAL)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        paypal_auth_service_1.PaypalAuthService,
        config_1.ConfigService, Object])
], PaypalDisputeService);
//# sourceMappingURL=paypal-dispute.service.js.map