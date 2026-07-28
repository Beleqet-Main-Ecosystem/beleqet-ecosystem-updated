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
var AnomalySensorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnomalySensorService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const prisma_service_1 = require("../../prisma/prisma.service");
const alerting_service_1 = require("./alerting.service");
let AnomalySensorService = AnomalySensorService_1 = class AnomalySensorService {
    constructor(prisma, alertingService) {
        this.prisma = prisma;
        this.alertingService = alertingService;
        this.logger = new common_1.Logger(AnomalySensorService_1.name);
        this.authFailures = new Map();
    }
    onModuleInit() {
        this.cleanupInterval = setInterval(() => this.pruneStaleAuthFailures(), 5 * 60 * 1000);
        this.cleanupInterval.unref();
    }
    onModuleDestroy() {
        clearInterval(this.cleanupInterval);
    }
    pruneStaleAuthFailures() {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        for (const [email, times] of this.authFailures.entries()) {
            const recent = times.filter((t) => t > fiveMinutesAgo);
            if (recent.length === 0) {
                this.authFailures.delete(email);
            }
            else {
                this.authFailures.set(email, recent);
            }
        }
    }
    async handleAuthFailed(payload) {
        const { email } = payload;
        const now = Date.now();
        const fiveMinutesAgo = now - 5 * 60 * 1000;
        let failures = this.authFailures.get(email) || [];
        failures = failures.filter((time) => time > fiveMinutesAgo);
        failures.push(now);
        if (!this.authFailures.has(email) &&
            this.authFailures.size >= AnomalySensorService_1.MAX_TRACKED_EMAILS) {
            const oldestKey = this.authFailures.keys().next().value;
            if (oldestKey)
                this.authFailures.delete(oldestKey);
        }
        this.authFailures.set(email, failures);
        if (failures.length > 5) {
            this.logger.warn(`Auth anomaly detected for email: ${email}`);
            await this.logAnomaly('AUTH_BRUTE_FORCE', email, 'User', {
                failures: failures.length,
                window: '5 minutes',
                ip: payload.ip,
            });
            await this.alertingService.dispatchAlert({
                title: 'Authentication Brute Force Attempt',
                message: `Multiple failed login attempts (${failures.length}) detected for ${email} within 5 minutes.`,
                severity: 'HIGH',
                timestamp: new Date().toISOString(),
            });
            this.authFailures.set(email, []);
        }
    }
    handleAuthSuccess(payload) {
        this.authFailures.delete(payload.email);
    }
    async handlePaymentInitiated(payload) {
        const { clientId, grossAmount, escrowId, currency } = payload;
        const history = await this.prisma.escrowTransaction.findMany({
            where: {
                freelanceJob: { clientId },
                id: { not: escrowId },
                status: { in: ['FUNDED', 'RELEASED'] },
                currency,
            },
            select: { grossAmount: true, currency: true },
        });
        if (history.length < 3) {
            return;
        }
        const amounts = history.map((tx) => tx.grossAmount);
        const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const stdDev = Math.sqrt(amounts.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / amounts.length) || 1;
        const zScore = (grossAmount - mean) / stdDev;
        if (zScore > 2.5) {
            this.logger.warn(`Payment anomaly detected for client: ${clientId}, Z-Score: ${zScore.toFixed(2)}`);
            await this.logAnomaly('PAYMENT_UNUSUAL_AMOUNT', clientId, 'User', {
                escrowId,
                amount: grossAmount,
                currency,
                zScore,
                meanAmount: mean,
            });
            await this.alertingService.dispatchAlert({
                title: 'Suspicious Payment Transaction',
                message: `Unusually large transaction initiated by client ${clientId}. Amount: ${grossAmount} ${currency} (Z-Score: ${zScore.toFixed(2)}).`,
                severity: 'CRITICAL',
                timestamp: new Date().toISOString(),
            });
        }
    }
    async logAnomaly(type, entityId, entityType, details) {
        try {
            await this.prisma.eventLog.create({
                data: {
                    eventType: 'ANOMALY_DETECTED',
                    entityId,
                    entityType,
                    payload: { type, ...details },
                    processedBy: AnomalySensorService_1.name,
                },
            });
        }
        catch (error) {
            this.logger.error(`Failed to save audit log: ${error.message}`);
        }
    }
};
exports.AnomalySensorService = AnomalySensorService;
AnomalySensorService.MAX_TRACKED_EMAILS = 10_000;
__decorate([
    (0, event_emitter_1.OnEvent)('auth.login.failed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnomalySensorService.prototype, "handleAuthFailed", null);
__decorate([
    (0, event_emitter_1.OnEvent)('auth.login.success'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AnomalySensorService.prototype, "handleAuthSuccess", null);
__decorate([
    (0, event_emitter_1.OnEvent)('payment.escrow.initiated'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AnomalySensorService.prototype, "handlePaymentInitiated", null);
exports.AnomalySensorService = AnomalySensorService = AnomalySensorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        alerting_service_1.AlertingService])
], AnomalySensorService);
//# sourceMappingURL=anomaly-sensor.service.js.map