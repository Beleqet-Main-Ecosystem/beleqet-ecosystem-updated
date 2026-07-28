import { OAuthProfile } from '../interfaces/oauth-profile.interface';
import { IAccountRepository } from '../interfaces/account-repository.interface';
import { OAuthSignInOutcome } from '../interfaces/link-account-result.interface';
import { IAuditLogger } from '../interfaces/audit-logger.interface';
export declare const ACCOUNT_REPOSITORY: unique symbol;
export declare class AccountLinkingService {
    private readonly accountRepository;
    private readonly auditLogger;
    constructor(accountRepository: IAccountRepository, auditLogger: IAuditLogger);
    handleOAuthSignIn(profile: OAuthProfile, encryptedAccessToken: string, encryptedRefreshToken?: string): Promise<OAuthSignInOutcome>;
    confirmPendingLink(confirmationToken: string, profile: OAuthProfile, encryptedAccessToken: string, encryptedRefreshToken?: string): Promise<import('../interfaces/account-repository.interface').UserIdentitySnapshot>;
}
