export declare enum UserRole {
    ADMIN = "ADMIN",
    EMPLOYER = "EMPLOYER",
    JOB_SEEKER = "JOB_SEEKER",
    FREELANCER = "FREELANCER"
}
export declare class RegisterDto {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role?: UserRole;
}
export declare class LoginDto {
    email: string;
    password: string;
}
export declare class RefreshDto {
    refreshToken: string;
}
export declare class VerifyEmailDto {
    token: string;
}
export declare class ForgotPasswordDto {
    email: string;
}
export declare class ResetPasswordDto {
    token: string;
    newPassword: string;
}
