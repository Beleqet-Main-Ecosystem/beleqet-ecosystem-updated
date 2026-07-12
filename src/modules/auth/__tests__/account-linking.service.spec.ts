import { Test, TestingModule } from '@nestjs/testing';
import { AccountLinkingService, ACCOUNT_REPOSITORY } from '../services/account-linking.service';
import {
  IAccountRepository,
  UserIdentitySnapshot,
  VerificationTokenType,
} from '../interfaces/account-repository.interface';
import { OAuthProfile, OAuthProvider } from '../interfaces/oauth-profile.interface';
import {
  InvalidLinkConfirmationTokenError,
  ProviderIdentityAlreadyLinkedError,
  UnverifiedEmailLinkAttemptError,
} from '../errors/auth.errors';
import { AUDIT_LOGGER, IAuditLogger } from '../interfaces/audit-logger.interface';

/**
 * Builds a fully-typed mock of {@link IAccountRepository}. Every method is
 * a `jest.fn()` so individual tests can configure only the behavior they
 * need via `mockResolvedValueOnce` / `mockResolvedValue`.
 */
function createMockRepository(): jest.Mocked<IAccountRepository> {
  return {
    findOAuthAccount: jest.fn(),
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    createUserWithOAuthAccount: jest.fn(),
    attachOAuthAccount: jest.fn(),
    issueVerificationToken: jest.fn(),
    consumeVerificationToken: jest.fn(),
  };
}

function buildProfile(overrides: Partial<OAuthProfile> = {}): OAuthProfile {
  return {
    provider: OAuthProvider.GOOGLE,
    providerAccountId: 'google-sub-123',
    email: 'jane.doe@example.com',
    emailVerified: true,
    firstName: 'Jane',
    lastName: 'Doe',
    rawAccessToken: 'raw-access-token',
    ...overrides,
  };
}

function buildUser(overrides: Partial<UserIdentitySnapshot> = {}): UserIdentitySnapshot {
  return {
    id: 'user-1',
    email: 'jane.doe@example.com',
    emailVerified: true,
    firstName: 'Jane',
    lastName: 'Doe',
    hasPasswordCredential: true,
    ...overrides,
  };
}

describe('AccountLinkingService', () => {
  let service: AccountLinkingService;
  let repository: jest.Mocked<IAccountRepository>;
  let auditLogger: jest.Mocked<IAuditLogger>;

  beforeEach(async () => {
    repository = createMockRepository();
    auditLogger = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountLinkingService,
        { provide: ACCOUNT_REPOSITORY, useValue: repository },
        { provide: AUDIT_LOGGER, useValue: auditLogger },
      ],
    }).compile();

    service = module.get(AccountLinkingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleOAuthSignIn', () => {
    it('returns a LOGIN outcome when the provider identity is already linked', async () => {
      const existingUser = buildUser();
      repository.findOAuthAccount.mockResolvedValueOnce({
        userId: existingUser.id,
        provider: OAuthProvider.GOOGLE,
        providerAccountId: 'google-sub-123',
      });
      repository.findUserById.mockResolvedValueOnce(existingUser);

      const result = await service.handleOAuthSignIn(
        buildProfile(),
        'encrypted-access-token',
      );

      expect(result).toEqual({ kind: 'LOGIN', user: existingUser });
      expect(repository.findUserByEmail).not.toHaveBeenCalled();
      expect(repository.createUserWithOAuthAccount).not.toHaveBeenCalled();
    });

    it('throws ProviderIdentityAlreadyLinkedError if the linked user record is missing (data integrity edge case)', async () => {
      repository.findOAuthAccount.mockResolvedValueOnce({
        userId: 'orphaned-user-id',
        provider: OAuthProvider.GOOGLE,
        providerAccountId: 'google-sub-123',
      });
      repository.findUserById.mockResolvedValueOnce(null);

      await expect(
        service.handleOAuthSignIn(buildProfile(), 'token'),
      ).rejects.toBeInstanceOf(ProviderIdentityAlreadyLinkedError);
    });

    it('returns a SIGNUP outcome and provisions a new user when no email match exists', async () => {
      repository.findOAuthAccount.mockResolvedValueOnce(null);
      repository.findUserByEmail.mockResolvedValueOnce(null);
      const newUser = buildUser({ hasPasswordCredential: false });
      repository.createUserWithOAuthAccount.mockResolvedValueOnce(newUser);

      const result = await service.handleOAuthSignIn(
        buildProfile(),
        'encrypted-access-token',
        'encrypted-refresh-token',
      );

      expect(result).toEqual({ kind: 'SIGNUP', user: newUser });
      expect(repository.createUserWithOAuthAccount).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'jane.doe@example.com',
          provider: OAuthProvider.GOOGLE,
          providerAccountId: 'google-sub-123',
          encryptedAccessToken: 'encrypted-access-token',
          encryptedRefreshToken: 'encrypted-refresh-token',
        }),
      );
    });

    it('throws UnverifiedEmailLinkAttemptError when email matches an existing user but the provider did not verify it', async () => {
      repository.findOAuthAccount.mockResolvedValueOnce(null);
      repository.findUserByEmail.mockResolvedValueOnce(buildUser());

      const unverifiedProfile = buildProfile({ emailVerified: false });

      await expect(
        service.handleOAuthSignIn(unverifiedProfile, 'token'),
      ).rejects.toBeInstanceOf(UnverifiedEmailLinkAttemptError);

      // Critical assertion: no linking or signup side effect must occur.
      expect(repository.issueVerificationToken).not.toHaveBeenCalled();
      expect(repository.attachOAuthAccount).not.toHaveBeenCalled();
      expect(repository.createUserWithOAuthAccount).not.toHaveBeenCalled();
    });

    it('returns PENDING_CONFIRMATION (never auto-links) when email matches and provider verified the email', async () => {
      const existingUser = buildUser();
      repository.findOAuthAccount.mockResolvedValueOnce(null);
      repository.findUserByEmail.mockResolvedValueOnce(existingUser);
      repository.issueVerificationToken.mockResolvedValueOnce('confirmation-token-abc');

      const result = await service.handleOAuthSignIn(
        buildProfile({ emailVerified: true }),
        'token',
      );

      expect(result).toEqual({
        kind: 'PENDING_CONFIRMATION',
        candidateUserId: existingUser.id,
        candidateEmail: existingUser.email,
        confirmationToken: 'confirmation-token-abc',
      });
      expect(repository.issueVerificationToken).toHaveBeenCalledWith(
        existingUser.id,
        VerificationTokenType.OAUTH_LINK_CONFIRMATION,
      );
      // The identity must NOT be attached automatically at this stage.
      expect(repository.attachOAuthAccount).not.toHaveBeenCalled();
    });
  });

  describe('confirmPendingLink', () => {
    it('attaches the provider identity after a valid confirmation token is consumed', async () => {
      repository.consumeVerificationToken.mockResolvedValueOnce({ userId: 'user-1' });
      repository.findOAuthAccount.mockResolvedValueOnce(null);
      const linkedUser = buildUser();
      // Called twice in the real flow now: once for the pre-attach
      // existence check, once for the final post-attach fetch.
      repository.findUserById.mockResolvedValueOnce(linkedUser).mockResolvedValueOnce(linkedUser);

      const result = await service.confirmPendingLink(
        'confirmation-token-abc',
        buildProfile(),
        'encrypted-access-token',
      );

      expect(result).toEqual(linkedUser);
      expect(repository.attachOAuthAccount).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', provider: OAuthProvider.GOOGLE }),
      );
    });

    it('throws InvalidLinkConfirmationTokenError for an invalid/expired/reused token', async () => {
      repository.consumeVerificationToken.mockResolvedValueOnce(null);

      await expect(
        service.confirmPendingLink('bad-token', buildProfile(), 'token'),
      ).rejects.toBeInstanceOf(InvalidLinkConfirmationTokenError);

      expect(repository.attachOAuthAccount).not.toHaveBeenCalled();
    });

    it('throws ProviderIdentityAlreadyLinkedError if the identity got linked to a different user in the meantime (race condition guard)', async () => {
      repository.consumeVerificationToken.mockResolvedValueOnce({ userId: 'user-1' });
      repository.findOAuthAccount.mockResolvedValueOnce({
        userId: 'a-different-user',
        provider: OAuthProvider.GOOGLE,
        providerAccountId: 'google-sub-123',
      });

      await expect(
        service.confirmPendingLink('confirmation-token-abc', buildProfile(), 'token'),
      ).rejects.toBeInstanceOf(ProviderIdentityAlreadyLinkedError);

      expect(repository.attachOAuthAccount).not.toHaveBeenCalled();
    });

    it('throws InvalidLinkConfirmationTokenError if the user disappears immediately after linking (defensive edge case)', async () => {
      repository.consumeVerificationToken.mockResolvedValueOnce({ userId: 'user-1' });
      repository.findOAuthAccount.mockResolvedValueOnce(null);
      repository.findUserById.mockResolvedValueOnce(null);

      await expect(
        service.confirmPendingLink('confirmation-token-abc', buildProfile(), 'token'),
      ).rejects.toBeInstanceOf(InvalidLinkConfirmationTokenError);
    });

    it('throws InvalidLinkConfirmationTokenError if the user was deleted before the attach step (pre-check)', async () => {
      repository.consumeVerificationToken.mockResolvedValueOnce({ userId: 'user-1' });
      repository.findOAuthAccount.mockResolvedValueOnce(null);
      // The pre-attach existence check finds no user at all.
      repository.findUserById.mockResolvedValueOnce(null);

      await expect(
        service.confirmPendingLink('confirmation-token-abc', buildProfile(), 'token'),
      ).rejects.toBeInstanceOf(InvalidLinkConfirmationTokenError);

      expect(repository.attachOAuthAccount).not.toHaveBeenCalled();
    });

    it('throws InvalidLinkConfirmationTokenError (not an unhandled 500) if attachOAuthAccount fails, e.g. due to a concurrent-deletion foreign key violation', async () => {
      repository.consumeVerificationToken.mockResolvedValueOnce({ userId: 'user-1' });
      repository.findOAuthAccount.mockResolvedValueOnce(null);
      // Pre-attach check passes (user still exists at that instant)...
      repository.findUserById.mockResolvedValueOnce(buildUser());
      // ...but the attach itself fails, simulating the user having been
      // deleted in the narrow window between the check and the insert.
      repository.attachOAuthAccount.mockRejectedValueOnce(
        new Error('Foreign key constraint violated: OAuthAccount_userId_fkey (P2003)'),
      );

      await expect(
        service.confirmPendingLink('confirmation-token-abc', buildProfile(), 'token'),
      ).rejects.toBeInstanceOf(InvalidLinkConfirmationTokenError);
    });
  });
});
