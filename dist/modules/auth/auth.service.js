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
const bull_1 = require("@nestjs/bull");
const queues_constants_1 = require("../queues/queues.constants");
const email_templates_1 = require("../notifications/email-templates");
let AuthService = AuthService_1 = class AuthService {
    constructor(prisma, jwt, config, notificationsQueue) {
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.notificationsQueue = notificationsQueue;
        this.logger = new common_1.Logger(AuthService_1.name);
    }
    async register(dto) {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing)
            throw new common_1.ConflictException('Email already registered');
        const passwordHash = await bcrypt.hash(dto.password, 12);
        const user = await this.prisma.user.create({
            data: {
                email: dto.email.toLowerCase().trim(),
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
        const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        if (!user || !user.isActive)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        return user;
    }
    async login(user, userAgent) {
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
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
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
            }
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
        if (!verificationToken || verificationToken.type !== 'EMAIL_VERIFICATION' || verificationToken.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Invalid or expired verification token');
        }
        await this.prisma.user.update({
            where: { id: verificationToken.userId },
            data: { emailVerified: true }
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
            }
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
        if (!verificationToken || verificationToken.type !== 'PASSWORD_RESET' || verificationToken.expiresAt < new Date()) {
            throw new common_1.BadRequestException('Invalid or expired reset token');
        }
        const passwordHash = await bcrypt.hash(newPassword, 12);
        await this.prisma.user.update({
            where: { id: verificationToken.userId },
            data: { passwordHash }
        });
        await this.prisma.verificationToken.deleteMany({ where: { userId: verificationToken.userId, type: 'PASSWORD_RESET' } });
        return { success: true, message: 'Password reset successfully' };
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
        await this.prisma.refreshToken.create({
            data: { token: refreshTokenStr, userId: user.id, expiresAt },
        });
        const MAX_SESSIONS = 5;
        const tokens = await this.prisma.refreshToken.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
        });
        if (tokens.length > MAX_SESSIONS) {
            const toDelete = tokens.slice(0, tokens.length - MAX_SESSIONS).map((t) => t.id);
            await this.prisma.refreshToken.deleteMany({ where: { id: { in: toDelete } } });
        }
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
    __param(3, (0, bull_1.InjectQueue)(queues_constants_1.QUEUE_NAMES.NOTIFICATIONS)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService, Object])
], AuthService);
//# sourceMappingURL=auth.service.js.map