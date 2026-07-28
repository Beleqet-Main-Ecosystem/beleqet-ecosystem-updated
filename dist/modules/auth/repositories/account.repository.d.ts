import { PrismaService } from '../../../prisma/prisma.service';
import { AttachOAuthAccountInput, CreateOAuthUserInput, IAccountRepository, OAuthAccountSnapshot, UserIdentitySnapshot, VerificationTokenType } from '../interfaces/account-repository.interface';
import { OAuthProvider } from '../interfaces/oauth-profile.interface';
export declare class AccountRepository implements IAccountRepository {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findOAuthAccount(provider: OAuthProvider, providerAccountId: string): Promise<OAuthAccountSnapshot | null>;
    findUserByEmail(email: string): Promise<UserIdentitySnapshot | null>;
    findUserById(userId: string): Promise<UserIdentitySnapshot | null>;
    createUserWithOAuthAccount(input: CreateOAuthUserInput): Promise<UserIdentitySnapshot>;
    attachOAuthAccount(input: AttachOAuthAccountInput): Promise<void>;
    issueVerificationToken(userId: string, type: VerificationTokenType): Promise<string>;
    consumeVerificationToken(token: string, expectedType: VerificationTokenType): Promise<{
        userId: string;
    } | null>;
    private toSnapshot;
}
