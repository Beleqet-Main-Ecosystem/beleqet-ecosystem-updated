import { OAuthProvider } from '@prisma/client';
export { OAuthProvider };
export interface OAuthProfile {
    readonly provider: OAuthProvider;
    readonly providerAccountId: string;
    readonly email: string;
    readonly emailVerified: boolean;
    readonly firstName: string;
    readonly lastName: string;
    readonly avatarUrl?: string;
    readonly rawAccessToken: string;
    readonly rawRefreshToken?: string;
    readonly tokenExpiresAt?: Date;
}
