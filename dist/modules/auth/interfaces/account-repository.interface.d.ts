import { OAuthProvider } from './oauth-profile.interface';
export interface UserIdentitySnapshot {
    readonly id: string;
    readonly email: string;
    readonly emailVerified: boolean;
    readonly firstName: string;
    readonly lastName: string;
    readonly hasPasswordCredential: boolean;
}
export interface OAuthAccountSnapshot {
    readonly userId: string;
    readonly provider: OAuthProvider;
    readonly providerAccountId: string;
}
export interface CreateOAuthUserInput {
    readonly email: string;
    readonly emailVerified: boolean;
    readonly firstName: string;
    readonly lastName: string;
    readonly avatarUrl?: string;
    readonly provider: OAuthProvider;
    readonly providerAccountId: string;
    readonly encryptedAccessToken: string;
    readonly encryptedRefreshToken?: string;
    readonly tokenExpiresAt?: Date;
}
export interface AttachOAuthAccountInput {
    readonly userId: string;
    readonly provider: OAuthProvider;
    readonly providerAccountId: string;
    readonly encryptedAccessToken: string;
    readonly encryptedRefreshToken?: string;
    readonly tokenExpiresAt?: Date;
}
export declare enum VerificationTokenType {
    OAUTH_LINK_CONFIRMATION = "OAUTH_LINK_CONFIRMATION"
}
export interface IAccountRepository {
    findOAuthAccount(provider: OAuthProvider, providerAccountId: string): Promise<OAuthAccountSnapshot | null>;
    findUserByEmail(email: string): Promise<UserIdentitySnapshot | null>;
    findUserById(userId: string): Promise<UserIdentitySnapshot | null>;
    createUserWithOAuthAccount(input: CreateOAuthUserInput): Promise<UserIdentitySnapshot>;
    attachOAuthAccount(input: AttachOAuthAccountInput): Promise<void>;
    issueVerificationToken(userId: string, type: VerificationTokenType): Promise<string>;
    consumeVerificationToken(token: string, expectedType: VerificationTokenType): Promise<{
        userId: string;
    } | null>;
}
