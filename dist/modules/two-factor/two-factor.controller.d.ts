import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { TwoFactorService } from './two-factor.service';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfirmEnrollmentDto, VerifyDto, BackupCodeDto, StepUpDto, ChallengeDto, Disable2faDto } from './dto/two-factor.dto';
export declare class TwoFactorController {
    private readonly svc;
    private readonly jwt;
    private readonly authService;
    private readonly prisma;
    private readonly tempSecret;
    constructor(svc: TwoFactorService, jwt: JwtService, authService: AuthService, prisma: PrismaService, config: ConfigService);
    startEnrollment(user: CurrentUserPayload): Promise<{
        provisioningUri: string;
        enrollmentToken: string;
        secret: string;
    }>;
    confirmEnrollment(user: CurrentUserPayload, dto: ConfirmEnrollmentDto): Promise<{
        success: boolean;
        backupCodes: string[];
    }>;
    verify(dto: VerifyDto): Promise<import("../auth/auth.service").AuthenticatedSessionResponse>;
    requestChallenge(user: CurrentUserPayload, dto: ChallengeDto): {
        stepUpToken: string;
    };
    stepUp(dto: StepUpDto): Promise<{
        stepUpToken: string;
    }>;
    backupCode(dto: BackupCodeDto): Promise<{
        remainingBackupCodes: number;
        accessToken: string;
        refreshToken: string;
        user: import("../auth/auth.service").AuthenticatedUserResponse;
    }>;
    regenerateBackupCodes(user: CurrentUserPayload, dto: StepUpDto): Promise<{
        backupCodes: string[];
    }>;
    disable(user: CurrentUserPayload, dto: Disable2faDto): Promise<{
        success: boolean;
        message: string;
    }>;
}
