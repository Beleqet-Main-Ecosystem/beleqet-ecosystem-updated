import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, ChangePasswordDto, ChangeEmailDto } from './dto/register.dto';
import { Queue } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TwoFactorService } from '../two-factor/two-factor.service';
export interface AuthenticatedUserResponse {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
}
export interface AuthenticatedSessionResponse {
    accessToken: string;
    refreshToken: string;
    user: AuthenticatedUserResponse;
}
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    private readonly config;
    private readonly twoFactorService;
    private readonly notificationsQueue;
    private readonly eventEmitter;
    private readonly logger;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService, twoFactorService: TwoFactorService, notificationsQueue: Queue, eventEmitter: EventEmitter2);
    register(dto: RegisterDto): Promise<AuthenticatedSessionResponse>;
    validateUser(email: string, password: string): Promise<{
        email: string;
        firstName: string;
        lastName: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: string;
        location: string | null;
        createdAt: Date;
        updatedAt: Date;
        telegramId: string | null;
        passwordHash: string | null;
        avatarUrl: string | null;
        phone: string | null;
        isActive: boolean;
        emailVerified: boolean;
        bio: string | null;
        defaultResumeUrl: string | null;
        githubUrl: string | null;
        headline: string | null;
        linkedinUrl: string | null;
        portfolioUrl: string | null;
        skills: string[];
        clientFeedback: import("@prisma/client/runtime/library").JsonValue | null;
        skillVerified: boolean;
        kycVerified: boolean;
        gdprConsent: boolean;
    }>;
    login(user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
    }, userAgent?: string): Promise<AuthenticatedSessionResponse | {
        requires2fa: boolean;
        tempToken: string;
        factorId: string;
    }>;
    refresh(token: string): Promise<AuthenticatedSessionResponse>;
    logout(userId: string): Promise<void>;
    sendVerificationEmail(userId: string): Promise<void>;
    verifyEmail(token: string): Promise<{
        success: boolean;
        message: string;
    }>;
    forgotPassword(email: string): Promise<{
        success: boolean;
        message: string;
    }>;
    resetPassword(token: string, newPassword: string): Promise<{
        success: boolean;
        message: string;
    }>;
    private requireStepUpOrThrow;
    changePassword(userId: string, dto: ChangePasswordDto, stepUpToken?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    changeEmail(userId: string, dto: ChangeEmailDto, stepUpToken?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    issueTokensForUserId(userId: string): Promise<AuthenticatedSessionResponse>;
    issueTokens(user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
    }): Promise<AuthenticatedSessionResponse>;
}
