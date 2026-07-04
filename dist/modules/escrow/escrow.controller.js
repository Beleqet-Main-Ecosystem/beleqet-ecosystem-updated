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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscrowController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const escrow_service_1 = require("./escrow.service");
const config_1 = require("@nestjs/config");
const crypto = require("crypto");
let EscrowController = class EscrowController {
    constructor(svc, config) {
        this.svc = svc;
        this.config = config;
    }
    initiate(gigId, u) {
        return this.svc.initiate(u.userId, gigId);
    }
    async webhook(body, req, chapaSignature, xChapaSignature) {
        const signature = chapaSignature || xChapaSignature;
        const secret = this.config.get('CHAPA_WEBHOOK_SECRET');
        const isProduction = this.config.get('NODE_ENV') === 'production';
        if (req.method === 'POST') {
            if (isProduction && (!secret || !req.rawBody || !signature)) {
                throw new common_1.UnauthorizedException('Webhook signature verification failed: missing required components');
            }
            if (secret && req.rawBody && signature) {
                const hash = crypto.createHmac('sha256', secret)
                    .update(req.rawBody)
                    .digest('hex');
                if (hash !== signature) {
                    if (isProduction) {
                        throw new common_1.UnauthorizedException('Invalid Webhook Signature');
                    }
                    else {
                        console.warn(`[escrow-webhook] Signature mismatch in dev mode. Expected: ${signature}, Got: ${hash}`);
                    }
                }
            }
        }
        const payload = { ...body, ...req.query, tx_ref: req.query.trx_ref || body.tx_ref || req.query.tx_ref };
        try {
            if (req.method === 'GET') {
                await this.svc.handleWebhook(payload);
                const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:3000';
                return { url: `${frontendUrl}/freelance/payment-success` };
            }
            await this.svc.handleWebhook(payload);
            console.log(`[escrow-webhook] Successfully added to queue for tx_ref: ${payload.tx_ref}`);
            return { success: true };
        }
        catch (error) {
            console.error(`[escrow-webhook] Queue execution failed!`, error);
            throw error;
        }
    }
    release(id, u) {
        return this.svc.releaseMilestone(id, u.userId);
    }
};
exports.EscrowController = EscrowController;
__decorate([
    (0, common_1.Post)('initiate/:gigId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Param)('gigId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], EscrowController.prototype, "initiate", null);
__decorate([
    (0, common_1.Post)('callback'),
    (0, common_1.Get)('callback'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK, type: Object }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Headers)('chapa-signature')),
    __param(3, (0, common_1.Headers)('x-chapa-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", Promise)
], EscrowController.prototype, "webhook", null);
__decorate([
    (0, common_1.Post)('milestones/:id/release'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], EscrowController.prototype, "release", null);
exports.EscrowController = EscrowController = __decorate([
    (0, swagger_1.ApiTags)('escrow'),
    (0, common_1.Controller)('escrow'),
    __metadata("design:paramtypes", [escrow_service_1.EscrowService,
        config_1.ConfigService])
], EscrowController);
//# sourceMappingURL=escrow.controller.js.map