import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { Queue } from 'bull';
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    private readonly config;
    private readonly notificationsQueue;
    private readonly logger;
    constructor(prisma: PrismaService, jwt: JwtService, config: ConfigService, notificationsQueue: Queue);
    register(dto: RegisterDto): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            role: string;
        };
    }>;
    validateUser(email: string, password: string): Promise<{
        id: string;
        createdAt: Date;
        location: string | null;
        updatedAt: Date;
        skills: string[];
        portfolioUrl: string | null;
        email: string;
        passwordHash: string;
        firstName: string;
        lastName: string;
        role: import(".prisma/client").$Enums.UserRole;
        avatarUrl: string | null;
        phone: string | null;
        telegramId: string | null;
        isActive: boolean;
        emailVerified: boolean;
        bio: string | null;
        defaultResumeUrl: string | null;
        githubUrl: string | null;
        headline: string | null;
        linkedinUrl: string | null;
        clientFeedback: import("@prisma/client/runtime/library").JsonValue | null;
        skillVerified: boolean;
    }>;
    login(user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
    }, userAgent?: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            role: string;
        };
    }>;
    refresh(token: string): Promise<{
        accessToken: string;
        refreshToken: string;
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            role: string;
        };
    }>;
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
    private issueTokens;
}
