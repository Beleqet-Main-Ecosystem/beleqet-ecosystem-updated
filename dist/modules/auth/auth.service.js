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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const bcrypt = require("bcryptjs");
const uuid_1 = require("uuid");
const prisma_service_1 = require("../../prisma/prisma.service");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const queues_constants_1 = require("../queues/queues.constants");
const email_templates_1 = require("../notifications/email-templates");
const event_emitter_1 = require("@nestjs/event-emitter");
const two_factor_service_1 = require("../two-factor/two-factor.service");
let AuthService = AuthService_1 = class AuthService {
    constructor(prisma, jwt, config, twoFactorService, notificationsQueue, eventEmitter) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.twoFactorService = twoFactorService;
        this.notificationsQueue = notificationsQueue;
        this.eventEmitter = eventEmitter;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async register(dto) {
        const normalizedEmail = dto.email.toLowerCase().trim();
        const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existing)
            throw new common_1.ConflictException('Email already registered');
        const passwordHash = await bcrypt.hash(dto.password, 12);
        const user = await this.prisma.user.create({
            data: {
                email: normalizedEmail,
                passwordHash,
                firstName: dto.firstName,
                lastName: dto.lastName,
                role: dto.role ?? 'JOB_SEEKER',
            },
            select: { id: true, email: true, firstName: true, lastName: true, role: true },
        });
        this.logger.log(`New user registered: ${user.email} (${user.role})`);
        this.sendVerificationEmail(user.id).catch((err) => this.logger.error(`Failed to enqueue verification email for ${user.email}: ${err.message}`));
        const frontendUrl = this.config.get('FRONTEND_URL') ?? 'http://localhost:3000';
        const dashboardUrl = user.role === 'EMPLOYER'
            ? `${frontendUrl}/employer`
            : user.role === 'FREELANCER'
                ? `${frontendUrl}/profile`
                : `${frontendUrl}/jobs`;
        (0, email_templates_1.welcomeEmail)(user.firstName, user.role, dashboardUrl)
            .then((email) => this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_EMAIL, {
            to: user.email,
            subject: `Welcome to Beleqet, ${user.firstName}!`,
            ...email,
        }))
            .catch((err) => this.logger.error(`Failed to enqueue welcome email for ${user.email}: ${err.message}`));
        return this.issueTokens(user);
    }
    async validateUser(email, password) {
        const normalizedEmail = email.toLowerCase().trim();
        const user = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (!user || !user.isActive) {
            this.eventEmitter.emit('auth.login.failed', {
                email: normalizedEmail,
                timestamp: new Date().toISOString(),
            });
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (user.passwordHash === null) {
            throw new common_1.UnauthorizedException('This account uses social login. Try signing in with Google or LinkedIn instead.');
        }
        let hashToCompare = user.passwordHash;
        if (hashToCompare.startsWith('$wp$')) {
            hashToCompare = hashToCompare.replace('$wp$', '$');
        }
        const valid = await bcrypt.compare(password, hashToCompare);
        if (!valid) {
            this.eventEmitter.emit('auth.login.failed', {
                email: normalizedEmail,
                timestamp: new Date().toISOString(),
            });
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        if (hashToCompare !== user.passwordHash) {
            const newHash = await bcrypt.hash(password, 12);
            await this.prisma.user.update({
                where: { id: user.id },
                data: { passwordHash: newHash },
            });
        }
        this.eventEmitter.emit('auth.login.success', {
            email: normalizedEmail,
            timestamp: new Date().toISOString(),
        });
        return user;
    }
    async login(user, userAgent) {
        const twoFactorRecord = await this.prisma.userTwoFactor.findUnique({
            where: { userId: user.id, enabled: true },
            select: { id: true },
        });
        if (twoFactorRecord) {
            const { tempToken, factorId } = await this.twoFactorService.generateTempToken(user.id);
            (0, email_templates_1.loginAlertEmail)(user.firstName, userAgent)
                .then((email) => this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_EMAIL, {
                to: user.email,
                subject: 'New login detected on your Beleqet account',
                ...email,
            }))
                .catch((err) => this.logger.error(`Failed to enqueue login alert email for ${user.email}: ${err.message}`));
            return { requires2fa: true, tempToken, factorId };
        }
        (0, email_templates_1.loginAlertEmail)(user.firstName, userAgent)
            .then((email) => this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_EMAIL, {
            to: user.email,
            subject: 'New login detected on your Beleqet account',
            ...email,
        }))
            .catch((err) => this.logger.error(`Failed to enqueue login alert email for ${user.email}: ${err.message}`));
        return this.issueTokens(user);
    }
    async refresh(token) {
        const storedToken = await this.prisma.refreshToken.findUnique({
            where: { token },
            include: { user: true },
        });
        if (!storedToken || storedToken.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
        }
        await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
        return this.issueTokens(storedToken.user);
    }
    async logout(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, firstName: true },
        });
        await this.prisma.refreshToken.deleteMany({ where: { userId } });
        if (user) {
            (0, email_templates_1.logoutAlertEmail)(user.firstName)
                .then((email) => this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_EMAIL, {
                to: user.email,
                subject: 'You have logged out from Beleqet',
                ...email,
            }))
                .catch((err) => this.logger.error(`Failed to enqueue logout alert email for ${user.email}: ${err.message}`));
        }
    }
    async sendVerificationEmail(userId) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return;
        const token = (0, uuid_1.v4)();
        await this.prisma.verificationToken.create({
            data: {
                userId: user.id,
                token,
                type: 'EMAIL_VERIFICATION',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
        });
        const verifyUrl = `${this.config.get('FRONTEND_URL')}/auth/verify-email?token=${token}`;
        const email = await (0, email_templates_1.verificationEmail)(user.firstName, verifyUrl);
        await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_EMAIL, {
            to: user.email,
            subject: 'Verify your Beleqet Account',
            ...email,
        });
    }
    async verifyEmail(token) {
        const verificationToken = await this.prisma.verificationToken.findUnique({ where: { token } });
        if (!verificationToken ||
            verificationToken.type !== 'EMAIL_VERIFICATION' ||
            verificationToken.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Invalid or expired verification token');
        }
        await this.prisma.user.update({
            where: { id: verificationToken.userId },
            data: { emailVerified: true },
        });
        await this.prisma.verificationToken.delete({ where: { id: verificationToken.id } });
        return { success: true, message: 'Email verified successfully' };
    }
    async forgotPassword(email) {
        const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user)
            return { success: true, message: 'If an account exists, a reset link was sent.' };
        const token = (0, uuid_1.v4)();
        await this.prisma.verificationToken.create({
            data: {
                userId: user.id,
                token,
                type: 'PASSWORD_RESET',
                expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
            },
        });
        const resetUrl = `${this.config.get('FRONTEND_URL')}/auth/reset-password?token=${token}`;
        const emailContent = await (0, email_templates_1.passwordResetEmail)(user.firstName, resetUrl);
        await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_EMAIL, {
            to: user.email,
            subject: 'Reset your Beleqet Password',
            ...emailContent,
        });
        return { success: true, message: 'If an account exists, a reset link was sent.' };
    }
    async resetPassword(token, newPassword) {
        const verificationToken = await this.prisma.verificationToken.findUnique({ where: { token } });
        if (!verificationToken ||
            verificationToken.type !== 'PASSWORD_RESET' ||
            verificationToken.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Invalid or expired reset token');
        }
        const passwordHash = await bcrypt.hash(newPassword, 12);
        await this.prisma.user.update({
            where: { id: verificationToken.userId },
            data: { passwordHash },
        });
        await this.prisma.refreshToken.deleteMany({ where: { userId: verificationToken.userId } });
        await this.prisma.verificationToken.deleteMany({
            where: { userId: verificationToken.userId, type: 'PASSWORD_RESET' },
        });
        return { success: true, message: 'Password reset successfully' };
    }
    async requireStepUpOrThrow(userId, stepUpToken) {
        const twoFactorRecord = await this.prisma.userTwoFactor.findUnique({
            where: { userId, enabled: true },
        });
        if (!twoFactorRecord)
            return;
        if (!stepUpToken) {
            const tempSecret = this.config.get('TOTP_TEMP_SECRET');
            const challengeToken = this.jwt.sign({ sub: userId, purpose: '2fa_step_up_challenge', iat: Math.floor(Date.now() / 1000) }, { secret: tempSecret, expiresIn: '5m' });
            throw new common_1.UnauthorizedException({
                requiresStepUp: true,
                message: 'Step-up verification required. Please re-verify your identity.',
                stepUpToken: challengeToken,
            });
        }
        const tempSecret = this.config.get('TOTP_TEMP_SECRET');
        let payload;
        try {
            payload = this.jwt.verify(stepUpToken, { secret: tempSecret });
        }
        catch {
            throw new common_1.UnauthorizedException('Invalid or expired step-up token');
        }
        if (payload.purpose !== '2fa_step_up' || !payload['2fa_verified_at']) {
            throw new common_1.UnauthorizedException('Invalid step-up token purpose');
        }
        const now = Math.floor(Date.now() / 1000);
        if (now - payload['2fa_verified_at'] > 15 * 60) {
            const challengeToken = this.jwt.sign({ sub: userId, purpose: '2fa_step_up_challenge', iat: now }, { secret: tempSecret, expiresIn: '5m' });
            throw new common_1.UnauthorizedException({
                requiresStepUp: true,
                message: 'Step-up verification has expired. Please re-verify.',
                stepUpToken: challengeToken,
            });
        }
        if (payload.sub !== userId) {
            throw new common_1.UnauthorizedException('Step-up token does not match current user');
        }
    }
    async changePassword(userId, dto, stepUpToken) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.UnauthorizedException('User not found');
        if (user.passwordHash === null) {
            throw new common_1.BadRequestException('This account uses social login and has no password to change.');
        }
        const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if (!valid)
            throw new common_1.BadRequestException('Current password is incorrect');
        await this.requireStepUpOrThrow(userId, stepUpToken);
        const passwordHash = await bcrypt.hash(dto.newPassword, 12);
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash },
        });
        await this.prisma.refreshToken.deleteMany({ where: { userId } });
        this.logger.log(`Password changed for user ${userId}`);
        return { success: true, message: 'Password changed successfully' };
    }
    async changeEmail(userId, dto, stepUpToken) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.UnauthorizedException('User not found');
        const existing = await this.prisma.user.findUnique({
            where: { email: dto.newEmail.toLowerCase().trim() },
        });
        if (existing && existing.id !== userId) {
            throw new common_1.ConflictException('Email is already in use');
        }
        if (user.passwordHash === null) {
            throw new common_1.BadRequestException('This account uses social login and has no password to verify this change.');
        }
        const valid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!valid)
            throw new common_1.BadRequestException('Password is incorrect');
        await this.requireStepUpOrThrow(userId, stepUpToken);
        await this.prisma.user.update({
            where: { id: userId },
            data: { email: dto.newEmail.toLowerCase().trim(), emailVerified: false },
        });
        await this.sendVerificationEmail(userId).catch((err) => this.logger.error(`Failed to send verification email: ${err.message}`));
        this.logger.log(`Email changed for user ${userId} to ${dto.newEmail}`);
        return {
            success: true,
            message: 'Email changed successfully. Verification sent to new address.',
        };
    }
    async issueTokensForUserId(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, firstName: true, lastName: true, role: true },
        });
        if (!user)
            throw new common_1.UnauthorizedException('User not found');
        return this.issueTokens(user);
    }
    async issueTokens(user) {
        const payload = { sub: user.id, email: user.email, role: user.role };
        const accessToken = this.jwt.sign(payload, {
            secret: this.config.get('JWT_ACCESS_SECRET'),
            expiresIn: this.config.get('JWT_ACCESS_EXPIRES', '15m'),
        });
        const refreshTokenStr = (0, uuid_1.v4)();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        const activeTokens = await this.prisma.refreshToken.findMany({
            where: { userId: user.id },
            orderBy: { expiresAt: 'asc' },
        });
        if (activeTokens.length >= 5) {
            const excessCount = activeTokens.length - 4;
            const tokensToRemove = activeTokens.slice(0, excessCount).map((t) => t.id);
            await this.prisma.refreshToken.deleteMany({
                where: { id: { in: tokensToRemove } },
            });
        }
        await this.prisma.refreshToken.create({
            data: {
                userId: user.id,
                token: refreshTokenStr,
                expiresAt,
            },
        });
        return {
            accessToken,
            refreshToken: refreshTokenStr,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
            },
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, bullmq_1.InjectQueue)(queues_constants_1.QUEUE_NAMES.NOTIFICATIONS)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        two_factor_service_1.TwoFactorService,
        bullmq_2.Queue,
        event_emitter_1.EventEmitter2])
], AuthService);
//# sourceMappingURL=auth.service.js.map