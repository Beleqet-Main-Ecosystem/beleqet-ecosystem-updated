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
var AuthController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("./auth.service");
const register_dto_1 = require("./dto/register.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const google_auth_guard_1 = require("./guards/google-auth.guard");
const linkedin_auth_guard_1 = require("./guards/linkedin-auth.guard");
const google_link_auth_guard_1 = require("./guards/google-link-auth.guard");
const linkedin_link_auth_guard_1 = require("./guards/linkedin-link-auth.guard");
const account_linking_service_1 = require("./services/account-linking.service");
const email_sender_interface_1 = require("./interfaces/email-sender.interface");
const auth_config_1 = require("./config/auth.config");
let AuthController = AuthController_1 = class AuthController {
    constructor(authService, accountLinkingService, emailSender, config) {
        this.authService = authService;
        this.accountLinkingService = accountLinkingService;
        this.emailSender = emailSender;
        this.config = config;
        this.logger = new common_1.Logger(AuthController_1.name);
    }
    register(dto) {
        return this.authService.register(dto);
    }
    async login(dto, req) {
        const user = await this.authService.validateUser(dto.email, dto.password);
        const userAgent = req.headers['user-agent'];
        return this.authService.login(user, userAgent);
    }
    refresh(dto) {
        return this.authService.refresh(dto.refreshToken);
    }
    logout(req) {
        return this.authService.logout(req.user.userId);
    }
    me(req) {
        return req.user;
    }
    verifyEmail(dto) {
        return this.authService.verifyEmail(dto.token);
    }
    forgotPassword(dto) {
        return this.authService.forgotPassword(dto.email);
    }
    resetPassword(dto) {
        return this.authService.resetPassword(dto.token, dto.newPassword);
    }
    changePassword(user, dto, stepUpToken) {
        return this.authService.changePassword(user.userId, dto, stepUpToken);
    }
    changeEmail(user, dto, stepUpToken) {
        return this.authService.changeEmail(user.userId, dto, stepUpToken);
    }
    googleLogin() {
    }
    async googleCallback(req) {
        return this.handleOAuthCallback(req);
    }
    linkedinLogin() {
    }
    async linkedinCallback(req) {
        return this.handleOAuthCallback(req);
    }
    googleLinkStart() {
    }
    linkedinLinkStart() {
    }
    async handleOAuthCallback(req) {
        const identity = req.user;
        const confirmationToken = this.extractState(req);
        if (confirmationToken !== undefined) {
            const user = await this.accountLinkingService.confirmPendingLink(confirmationToken, identity.profile, identity.encryptedAccessToken, identity.encryptedRefreshToken);
            const tokens = await this.authService.issueTokensForUserId(user.id);
            return { status: 'authenticated', tokens };
        }
        const outcome = await this.accountLinkingService.handleOAuthSignIn(identity.profile, identity.encryptedAccessToken, identity.encryptedRefreshToken);
        if (outcome.kind === 'PENDING_CONFIRMATION') {
            const linkPath = identity.profile.provider === 'GOOGLE' ? 'google' : 'linkedin';
            const confirmationUrl = `${this.config.appBaseUrl}/auth/${linkPath}/link?token=${outcome.confirmationToken}`;
            this.emailSender
                .sendAccountLinkConfirmation(outcome.candidateEmail, confirmationUrl)
                .catch((err) => this.logger.error(`Failed to send account-link confirmation email to ${outcome.candidateEmail}: ${err.message}`));
            return {
                status: 'confirmation_required',
                message: 'An account with this email already exists. Check your email to confirm linking this provider.',
            };
        }
        const tokens = await this.authService.issueTokensForUserId(outcome.user.id);
        return { status: 'authenticated', tokens };
    }
    extractState(req) {
        const state = req.query.state;
        if (typeof state !== 'string' || !state.startsWith('link:')) {
            return undefined;
        }
        return state.slice('link:'.length);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('register'),
    (0, swagger_1.ApiOperation)({ summary: 'Register a new user' }),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Login and receive JWT tokens' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK, type: Object }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Refresh access token' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RefreshDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    openapi.ApiResponse({ status: common_1.HttpStatus.NO_CONTENT }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get authenticated user profile' }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Post)('verify-email'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Verify user email via token' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.VerifyEmailDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "verifyEmail", null);
__decorate([
    (0, common_1.Post)('forgot-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Request password reset email' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.ForgotPasswordDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, common_1.Post)('reset-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Reset password via token' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.ResetPasswordDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Post)('change-password'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Change password (requires step-up if 2FA is enabled)' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-step-up-token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, register_dto_1.ChangePasswordDto, String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Post)('change-email'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Change email (requires step-up if 2FA is enabled)' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-step-up-token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, register_dto_1.ChangeEmailDto, String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "changeEmail", null);
__decorate([
    (0, common_1.Get)('google'),
    (0, common_1.UseGuards)(google_auth_guard_1.GoogleAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Start Google OAuth sign-in' }),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "googleLogin", null);
__decorate([
    (0, common_1.Get)('google/callback'),
    (0, common_1.UseGuards)(google_auth_guard_1.GoogleAuthGuard),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleCallback", null);
__decorate([
    (0, common_1.Get)('linkedin'),
    (0, common_1.UseGuards)(linkedin_auth_guard_1.LinkedInAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Start LinkedIn OIDC sign-in' }),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "linkedinLogin", null);
__decorate([
    (0, common_1.Get)('linkedin/callback'),
    (0, common_1.UseGuards)(linkedin_auth_guard_1.LinkedInAuthGuard),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "linkedinCallback", null);
__decorate([
    (0, common_1.Get)('google/link'),
    (0, common_1.UseGuards)(google_link_auth_guard_1.GoogleLinkAuthGuard),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "googleLinkStart", null);
__decorate([
    (0, common_1.Get)('linkedin/link'),
    (0, common_1.UseGuards)(linkedin_link_auth_guard_1.LinkedInLinkAuthGuard),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "linkedinLinkStart", null);
exports.AuthController = AuthController = AuthController_1 = __decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, common_1.Controller)('auth'),
    __param(2, (0, common_1.Inject)(email_sender_interface_1.EMAIL_SENDER)),
    __param(3, (0, common_1.Inject)(auth_config_1.AUTH_ENV_CONFIG)),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        account_linking_service_1.AccountLinkingService, Object, Object])
], AuthController);
//# sourceMappingURL=auth.controller.js.map