export declare class ConfirmEnrollmentDto {
    enrollmentToken: string;
    code: string;
}
export declare class VerifyDto {
    tempToken: string;
    code: string;
}
export declare class BackupCodeDto {
    tempToken: string;
    backupCode: string;
}
export declare class StepUpDto {
    stepUpToken: string;
    code: string;
    action?: string;
    resourceId?: string;
}
export declare class ChallengeDto {
    action: string;
    resourceId?: string;
}
export declare class Disable2faDto {
    code: string;
}
