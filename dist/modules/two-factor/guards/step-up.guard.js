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
var StepUpGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StepUpGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../../prisma/prisma.service");
const sensitive_action_decorator_1 = require("../decorators/sensitive-action.decorator");
const STEP_UP_WINDOW_MINUTES = 15;
const STEP_UP_TEMP_EXPIRY = 5;
let StepUpGuard = StepUpGuard_1 = class StepUpGuard {
    constructor(reflector, jwt, prisma, config) {
        this.reflector = reflector;
        this.jwt = jwt;
        this.prisma = prisma;
        this.logger = new common_1.Logger(StepUpGuard_1.name);
        this.accessSecret = config.get('JWT_ACCESS_SECRET');
        const ts = config.get('TOTP_TEMP_SECRET');
        if (!ts) {
            throw new Error('TOTP_TEMP_SECRET is required. Set it in your environment variables.');
        }
        this.tempSecret = ts;
    }
    async canActivate(context) {
        const isSensitive = this.reflector.getAllAndOverride(sensitive_action_decorator_1.SENSITIVE_ACTION_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!isSensitive)
            return true;
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers?.authorization;
        if (!authHeader) {
            throw new common_1.UnauthorizedException('Missing authorization header');
        }
        const token = authHeader.replace('Bearer ', '');
        const stepUpHeader = request.headers?.['x-step-up-token'];
        if (stepUpHeader) {
            const stepUpPayload = this.tryVerifyStepUp(stepUpHeader);
            if (stepUpPayload) {
                this.validateStepUpExpiry(request, stepUpPayload);
                this.validateActionScope(context, stepUpPayload);
                return true;
            }
        }
        const stepUpPayload = this.tryVerifyStepUp(token);
        if (stepUpPayload) {
            this.validateStepUpExpiry(request, stepUpPayload);
            this.validateActionScope(context, stepUpPayload);
            request.user = { userId: stepUpPayload.sub };
            return true;
        }
        const accessPayload = this.tryVerifyAccess(token);
        if (!accessPayload) {
            throw new common_1.UnauthorizedException('Invalid or expired token');
        }
        const userId = accessPayload.sub;
        request.user = { userId, email: accessPayload.email, role: accessPayload.role };
        const twoFactor = await this.prisma.userTwoFactor.findUnique({
            where: { userId },
        });
        if (!twoFactor?.enabled) {
            return true;
        }
        this.logger.warn(`Sensitive action attempted without step-up verification by user ${userId}`);
        throw new common_1.UnauthorizedException({
            requiresStepUp: true,
            message: 'This action requires recent two-factor verification. Please re-verify.',
            stepUpToken: this.generateStepUpChallenge(userId),
        });
    }
    validateStepUpExpiry(request, payload) {
        const now = Math.floor(Date.now() / 1000);
        if (now - payload['2fa_verified_at'] > STEP_UP_WINDOW_MINUTES * 60) {
            throw new common_1.UnauthorizedException({
                requiresStepUp: true,
                message: 'Step-up verification has expired. Please re-verify.',
                stepUpToken: this.generateStepUpChallenge(request.user?.userId),
            });
        }
    }
    validateActionScope(context, payload) {
        if (!payload.action)
            return;
        const routeAction = this.reflector.getAllAndOverride(sensitive_action_decorator_1.ACTION_TYPE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!routeAction)
            return;
        if (payload.action !== routeAction) {
            throw new common_1.ForbiddenException(`Step-up token scoped to "${payload.action}" but this endpoint requires "${routeAction}"`);
        }
    }
    tryVerifyStepUp(token) {
        try {
            const payload = this.jwt.verify(token, { secret: this.tempSecret });
            if (payload.purpose === '2fa_step_up' && payload['2fa_verified_at']) {
                return payload;
            }
            return null;
        }
        catch {
            return null;
        }
    }
    tryVerifyAccess(token) {
        try {
            return this.jwt.verify(token, { secret: this.accessSecret });
        }
        catch {
            return null;
        }
    }
    generateStepUpChallenge(userId) {
        return this.jwt.sign({
            sub: userId,
            purpose: '2fa_step_up_challenge',
            action: 'sensitive_action',
            iat: Math.floor(Date.now() / 1000),
        }, { secret: this.tempSecret, expiresIn: `${STEP_UP_TEMP_EXPIRY}m` });
    }
};
exports.StepUpGuard = StepUpGuard;
exports.StepUpGuard = StepUpGuard = StepUpGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        jwt_1.JwtService,
        prisma_service_1.PrismaService,
        config_1.ConfigService])
], StepUpGuard);
//# sourceMappingURL=step-up.guard.js.map