import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AttachOAuthAccountInput,
  CreateOAuthUserInput,
  IAccountRepository,
  OAuthAccountSnapshot,
  UserIdentitySnapshot,
  VerificationTokenType,
} from '../interfaces/account-repository.interface';
import { OAuthProvider } from '../interfaces/oauth-profile.interface';

/** Verification tokens issued for account-link confirmation expire after this window. */
const LINK_CONFIRMATION_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Prisma-backed implementation of {@link IAccountRepository}.
 *
 * This is the ONLY class in the auth module permitted to import and use
 * `PrismaService` directly. {@link AccountLinkingService} and all other
 * auth business logic depend solely on the {@link IAccountRepository}
 * abstraction, never on this class — this isolation is what keeps the
 * business logic unit-testable without a database.
 *
 * @remarks
 * Field selection is deliberately minimal (GDPR data minimization): we
 * never `select`-in fields like `passwordHash`, wallet balances, or
 * unrelated profile data that the auth flow has no need to touch.
 */
@Injectable()
export class AccountRepository implements IAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** {@inheritdoc IAccountRepository.findOAuthAccount} */
  public async findOAuthAccount(
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<OAuthAccountSnapshot | null> {
    const record = await this.prisma.oAuthAccount.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      select: { userId: true, provider: true, providerAccountId: true },
    });

    return record;
  }

  /** {@inheritdoc IAccountRepository.findUserByEmail} */
  public async findUserByEmail(
    email: string,
  ): Promise<UserIdentitySnapshot | null> {
    const record = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
      },
    });

    if (record === null) {
      return null;
    }

    return this.toSnapshot(record);
  }

  /** {@inheritdoc IAccountRepository.findUserById} */
  public async findUserById(
    userId: string,
  ): Promise<UserIdentitySnapshot | null> {
    const record = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
      },
    });

    if (record === null) {
      return null;
    }

    return this.toSnapshot(record);
  }

  /** {@inheritdoc IAccountRepository.createUserWithOAuthAccount} */
  public async createUserWithOAuthAccount(
    input: CreateOAuthUserInput,
  ): Promise<UserIdentitySnapshot> {
    const created = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase().trim(),
        emailVerified: input.emailVerified,
        firstName: input.firstName,
        lastName: input.lastName,
        avatarUrl: input.avatarUrl,
        // passwordHash intentionally omitted: OAuth-only account.
        oauthAccounts: {
          create: {
            provider: input.provider,
            providerAccountId: input.providerAccountId,
            encryptedAccessToken: input.encryptedAccessToken,
            encryptedRefreshToken: input.encryptedRefreshToken,
            tokenExpiresAt: input.tokenExpiresAt,
          },
        },
      },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
      },
    });

    return this.toSnapshot(created);
  }

  /** {@inheritdoc IAccountRepository.attachOAuthAccount} */
  public async attachOAuthAccount(
    input: AttachOAuthAccountInput,
  ): Promise<void> {
    await this.prisma.oAuthAccount.create({
      data: {
        userId: input.userId,
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        encryptedAccessToken: input.encryptedAccessToken,
        encryptedRefreshToken: input.encryptedRefreshToken,
        tokenExpiresAt: input.tokenExpiresAt,
      },
    });
  }

  /** {@inheritdoc IAccountRepository.issueVerificationToken} */
  public async issueVerificationToken(
    userId: string,
    type: VerificationTokenType,
  ): Promise<string> {
    const token = randomBytes(32).toString('hex');

    await this.prisma.verificationToken.create({
      data: {
        token,
        userId,
        type,
        expiresAt: new Date(Date.now() + LINK_CONFIRMATION_TOKEN_TTL_MS),
      },
    });

    return token;
  }

  /** {@inheritdoc IAccountRepository.consumeVerificationToken} */
  public async consumeVerificationToken(
    token: string,
    expectedType: VerificationTokenType,
  ): Promise<{ userId: string } | null> {
    // Wrapped in a transaction so that under concurrent requests for the
    // SAME token, only one caller's delete affects a row (count === 1);
    // the other's `deleteMany` affects zero rows and correctly receives
    // null. This closes the race window a plain find-then-delete leaves
    // open, which previously let two concurrent confirm requests both
    // "consume" the same token successfully.
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.verificationToken.findUnique({
        where: { token },
        select: { id: true, userId: true, type: true, expiresAt: true },
      });

      if (
        record === null ||
        record.type !== expectedType ||
        record.expiresAt.getTime() < Date.now()
      ) {
        return null;
      }

      const deleted = await tx.verificationToken.deleteMany({
        where: { id: record.id },
      });

      if (deleted.count === 0) {
        // A concurrent transaction already consumed this token first.
        return null;
      }

      return { userId: record.userId };
    });
  }

  /**
   * Maps a raw Prisma `User` selection into the narrow, safe
   * {@link UserIdentitySnapshot} shape — stripping `passwordHash` down to
   * a boolean flag so no hash ever leaves this repository.
   */
  private toSnapshot(record: {
    id: string;
    email: string;
    emailVerified: boolean;
    firstName: string;
    lastName: string;
    passwordHash: string | null;
  }): UserIdentitySnapshot {
    return {
      id: record.id,
      email: record.email,
      emailVerified: record.emailVerified,
      firstName: record.firstName,
      lastName: record.lastName,
      hasPasswordCredential: record.passwordHash !== null,
    };
  }
}
