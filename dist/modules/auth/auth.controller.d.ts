import { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshDto, VerifyEmailDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto, ChangeEmailDto } from './dto/register.dto';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AccountLinkingService } from './services/account-linking.service';
import { IEmailSender } from './interfaces/email-sender.interface';
import { AuthEnvConfig } from './config/auth.config';
type OAuthCallbackResponse = {
    status: 'authenticated';
    tokens: {
        accessToken: string;
        refreshToken: string;
    };
} | {
    status: 'confirmation_required';
    message: string;
};
export declare class AuthController {
    private readonly authService;
    private readonly accountLinkingService;
    private readonly emailSender;
    private readonly config;
    private readonly logger;
    constructor(authService: AuthService, accountLinkingService: AccountLinkingService, emailSender: IEmailSender, config: AuthEnvConfig);
    register(dto: RegisterDto): Promise<import("./auth.service").AuthenticatedSessionResponse>;
    login(dto: LoginDto, req: any): Promise<import("./auth.service").AuthenticatedSessionResponse | {
        requires2fa: boolean;
        tempToken: string;
        factorId: string;
    }>;
    refresh(dto: RefreshDto): Promise<import("./auth.service").AuthenticatedSessionResponse>;
    logout(req: Express.Request & {
        user: {
            userId: string;
        };
    }): Promise<void>;
    me(req: Express.Request & {
        user: {
            userId: string;
            email: string;
            role: string;
        };
    }): Express.User & {
        userId: string;
        email: string;
        role: string;
    };
    verifyEmail(dto: VerifyEmailDto): Promise<{
        success: boolean;
        message: string;
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        success: boolean;
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        success: boolean;
        message: string;
    }>;
    changePassword(user: CurrentUserPayload, dto: ChangePasswordDto, stepUpToken?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    changeEmail(user: CurrentUserPayload, dto: ChangeEmailDto, stepUpToken?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    googleLogin(): void;
    googleCallback(req: ExpressRequest): Promise<OAuthCallbackResponse>;
    linkedinLogin(): void;
    linkedinCallback(req: ExpressRequest): Promise<OAuthCallbackResponse>;
    googleLinkStart(): void;
    linkedinLinkStart(): void;
    private handleOAuthCallback;
    private extractState;
}
export {};
