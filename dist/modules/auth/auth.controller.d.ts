import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshDto, VerifyEmailDto, ForgotPasswordDto, ResetPasswordDto } from './dto/register.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
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
    login(dto: LoginDto, req: any): Promise<{
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
    refresh(dto: RefreshDto): Promise<{
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
}
