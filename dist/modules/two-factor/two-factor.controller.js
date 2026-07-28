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
exports.TwoFactorController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const two_factor_service_1 = require("./two-factor.service");
const auth_service_1 = require("../auth/auth.service");
const prisma_service_1 = require("../../prisma/prisma.service");
const two_factor_dto_1 = require("./dto/two-factor.dto");
const TOKEN_PURPOSE = {
    LOGIN: '2fa_login',
    ENROLLMENT: '2fa_enrollment',
    STEP_UP_CHALLENGE: '2fa_step_up_challenge',
    STEP_UP_VERIFIED: '2fa_step_up',
    BACKUP_CODE_LOGIN: '2fa_backup_code_login',
};
let TwoFactorController = class TwoFactorController {
    constructor(svc, jwt, authService, prisma, config) {
        this.svc = svc;
        this.jwt = jwt;
        this.authService = authService;
        this.prisma = prisma;
        const ts = config.get('TOTP_TEMP_SECRET');
        if (!ts) {
            throw new Error('TOTP_TEMP_SECRET is required. Set it in your environment variables.');
        }
        this.tempSecret = ts;
    }
    startEnrollment(user) {
        return this.svc.startEnrollment(user.userId);
    }
    confirmEnrollment(user, dto) {
        return this.svc.confirmEnrollment(user.userId, dto.enrollmentToken, dto.code);
    }
    async verify(dto) {
        let payload;
        try {
            payload = this.jwt.verify(dto.tempToken, { secret: this.tempSecret });
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired verification token');
        }
        if (payload.purpose !== TOKEN_PURPOSE.LOGIN) {
            throw new common_1.UnauthorizedException(`Invalid token purpose: expected ${TOKEN_PURPOSE.LOGIN}`);
        }
        const isValid = await this.svc.verifyLogin(payload.sub, dto.code);
        if (!isValid) {
            throw new common_1.UnauthorizedException('Invalid code');
        }
        const userRecord = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, email: true, firstName: true, lastName: true, role: true },
        });
        if (!userRecord) {
            throw new common_1.UnauthorizedException('User not found');
        }
        return this.authService.issueTokens(userRecord);
    }
    requestChallenge(user, dto) {
        const challengeToken = this.jwt.sign({
            sub: user.userId,
            purpose: TOKEN_PURPOSE.STEP_UP_CHALLENGE,
            action: dto.action,
            resourceId: dto.resourceId ?? null,
            iat: Math.floor(Date.now() / 1000),
        }, { secret: this.tempSecret, expiresIn: '5m' });
        return { stepUpToken: challengeToken };
    }
    async stepUp(dto) {
        let payload;
        try {
            payload = this.jwt.verify(dto.stepUpToken, { secret: this.tempSecret });
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired step-up token');
        }
        if (payload.purpose !== TOKEN_PURPOSE.STEP_UP_CHALLENGE) {
            throw new common_1.BadRequestException(`Invalid token purpose: expected ${TOKEN_PURPOSE.STEP_UP_CHALLENGE}`);
        }
        if (payload.action && payload.action !== 'sensitive_action') {
            if (!dto.action) {
                throw new common_1.BadRequestException(`Challenge token is scoped to action "${payload.action}" but request did not specify an action`);
            }
            if (payload.action !== dto.action) {
                throw new common_1.BadRequestException(`Challenge token scoped to action "${payload.action}" but request specified "${dto.action}"`);
            }
            if (payload.resourceId && dto.resourceId && payload.resourceId !== dto.resourceId) {
                throw new common_1.BadRequestException(`Challenge token scoped to resource "${payload.resourceId}" but request specified "${dto.resourceId}"`);
            }
        }
        const stepUpToken = await this.svc.verifyStepUp(payload.sub, dto.code, payload.action !== 'sensitive_action' ? payload.action : undefined, payload.resourceId);
        return { stepUpToken };
    }
    async backupCode(dto) {
        let payload;
        try {
            payload = this.jwt.verify(dto.tempToken, { secret: this.tempSecret });
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired token');
        }
        if (payload.purpose !== TOKEN_PURPOSE.LOGIN) {
            throw new common_1.UnauthorizedException(`Invalid token purpose: expected ${TOKEN_PURPOSE.LOGIN}`);
        }
        const remaining = await this.svc.verifyBackupCode(payload.sub, dto.backupCode);
        const userRecord = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, email: true, firstName: true, lastName: true, role: true },
        });
        if (!userRecord)
            throw new common_1.UnauthorizedException('User not found');
        const tokens = await this.authService.issueTokens(userRecord);
        return {
            ...tokens,
            remainingBackupCodes: remaining,
        };
    }
    async regenerateBackupCodes(user, dto) {
        let payload;
        try {
            payload = this.jwt.verify(dto.stepUpToken, { secret: this.tempSecret });
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired step-up token');
        }
        if (payload.purpose !== TOKEN_PURPOSE.STEP_UP_CHALLENGE) {
            throw new common_1.BadRequestException(`Invalid token purpose: expected ${TOKEN_PURPOSE.STEP_UP_CHALLENGE}`);
        }
        if (payload.sub !== user.userId) {
            throw new common_1.UnauthorizedException('Token does not match current user');
        }
        await this.svc.verifyStepUp(user.userId, dto.code, payload.action !== 'sensitive_action' ? payload.action : undefined, payload.resourceId);
        const codes = await this.svc.regenerateBackupCodes(user.userId);
        return { backupCodes: codes };
    }
    async disable(user, dto) {
        const isValid = await this.svc.verifyLogin(user.userId, dto.code);
        if (!isValid) {
            throw new common_1.UnauthorizedException('Invalid code');
        }
        await this.svc.disable(user.userId);
        return { success: true, message: 'Two-factor authentication disabled' };
    }
};
exports.TwoFactorController = TwoFactorController;
__decorate([
    (0, common_1.Post)('enroll'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Start 2FA enrollment — returns provisioning URI and enrollment token' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TwoFactorController.prototype, "startEnrollment", null);
__decorate([
    (0, common_1.Post)('confirm'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Confirm 2FA enrollment with TOTP code' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, two_factor_dto_1.ConfirmEnrollmentDto]),
    __metadata("design:returntype", void 0)
], TwoFactorController.prototype, "confirmEnrollment", null);
__decorate([
    (0, common_1.Post)('verify'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 900_000 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Verify 2FA code to complete login' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [two_factor_dto_1.VerifyDto]),
    __metadata("design:returntype", Promise)
], TwoFactorController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)('challenge'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 900_000 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Request an action-scoped step-up challenge token' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, two_factor_dto_1.ChallengeDto]),
    __metadata("design:returntype", void 0)
], TwoFactorController.prototype, "requestChallenge", null);
__decorate([
    (0, common_1.Post)('step-up'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 900_000 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Step-up verification for sensitive actions' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [two_factor_dto_1.StepUpDto]),
    __metadata("design:returntype", Promise)
], TwoFactorController.prototype, "stepUp", null);
__decorate([
    (0, common_1.Post)('backup-code'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 900_000 } }),
    (0, swagger_1.ApiOperation)({ summary: 'Use a backup code to complete login' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [two_factor_dto_1.BackupCodeDto]),
    __metadata("design:returntype", Promise)
], TwoFactorController.prototype, "backupCode", null);
__decorate([
    (0, common_1.Post)('backup-codes/regenerate'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Regenerate backup codes (requires OTP verification)' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, two_factor_dto_1.StepUpDto]),
    __metadata("design:returntype", Promise)
], TwoFactorController.prototype, "regenerateBackupCodes", null);
__decorate([
    (0, common_1.Post)('disable'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Disable 2FA (requires current OTP code)' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, two_factor_dto_1.Disable2faDto]),
    __metadata("design:returntype", Promise)
], TwoFactorController.prototype, "disable", null);
exports.TwoFactorController = TwoFactorController = __decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, common_1.Controller)('auth/2fa'),
    __metadata("design:paramtypes", [two_factor_service_1.TwoFactorService,
        jwt_1.JwtService,
        auth_service_1.AuthService,
        prisma_service_1.PrismaService,
        config_1.ConfigService])
], TwoFactorController);
//# sourceMappingURL=two-factor.controller.js.map