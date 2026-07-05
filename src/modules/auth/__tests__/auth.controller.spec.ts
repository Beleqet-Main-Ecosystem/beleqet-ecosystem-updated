import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { AuthController } from '../auth.controller';
import { AccountLinkingService } from '../services/account-linking.service';
import { TokenIssuanceService, TokenPair } from '../services/token-issuance.service';
import { EMAIL_SENDER, IEmailSender } from '../interfaces/email-sender.interface';
import { AUTH_ENV_CONFIG } from '../auth.module';
import { AuthEnvConfig } from '../config/auth.config';
import { OAuthProfile, OAuthProvider } from '../interfaces/oauth-profile.interface';
import { PreparedOAuthIdentity } from '../interfaces/prepared-oauth-identity.interface';
import { UserIdentitySnapshot } from '../interfaces/account-repository.interface';

function buildIdentity(overrides: Partial<OAuthProfile> = {}): PreparedOAuthIdentity {
  const profile: OAuthProfile = {
    provider: OAuthProvider.GOOGLE,
    providerAccountId: 'google-sub-123',
    email: 'jane.doe@example.com',
    emailVerified: true,
    firstName: 'Jane',
    lastName: 'Doe',
    rawAccessToken: 'raw-access-token',
    ...overrides,
  };
  return {
    profile,
    encryptedAccessToken: 'encrypted-access-token',
    encryptedRefreshToken: 'encrypted-refresh-token',
  };
}

function buildUser(overrides: Partial<UserIdentitySnapshot> = {}): UserIdentitySnapshot {
  return {
    id: 'user-1',
    email: 'jane.doe@example.com',
    emailVerified: true,
    firstName: 'Jane',
    lastName: 'Doe',
    hasPasswordCredential: false,
    ...overrides,
  };
}

function buildRequest(
  identity: PreparedOAuthIdentity,
  query: Record<string, string> = {},
): Request {
  return { user: identity, query } as unknown as Request;
}

const FAKE_TOKENS: TokenPair = { accessToken: 'access.jwt', refreshToken: 'refresh-raw' };

describe('AuthController', () => {
  let controller: AuthController;
  let accountLinkingService: jest.Mocked<
    Pick<AccountLinkingService, 'handleOAuthSignIn' | 'confirmPendingLink'>
  >;
  let tokenIssuanceService: jest.Mocked<
    Pick<TokenIssuanceService, 'issueTokenPair' | 'rotateRefreshToken'>
  >;
  let emailSender: jest.Mocked<IEmailSender>;

  beforeEach(async () => {
    accountLinkingService = {
      handleOAuthSignIn: jest.fn(),
      confirmPendingLink: jest.fn(),
    };
    tokenIssuanceService = {
      issueTokenPair: jest.fn(),
      rotateRefreshToken: jest.fn(),
    };
    emailSender = { sendAccountLinkConfirmation: jest.fn() };

    const config: Pick<AuthEnvConfig, 'appBaseUrl'> = {
      appBaseUrl: 'http://localhost:3000',
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AccountLinkingService, useValue: accountLinkingService },
        { provide: TokenIssuanceService, useValue: tokenIssuanceService },
        { provide: EMAIL_SENDER, useValue: emailSender },
        { provide: AUTH_ENV_CONFIG, useValue: config },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('googleCallback / linkedinCallback — fresh sign-in path', () => {
    it('issues tokens on a LOGIN outcome', async () => {
      const identity = buildIdentity();
      const user = buildUser();
      accountLinkingService.handleOAuthSignIn.mockResolvedValueOnce({ kind: 'LOGIN', user });
      tokenIssuanceService.issueTokenPair.mockResolvedValueOnce(FAKE_TOKENS);

      const result = await controller.googleCallback(buildRequest(identity));

      expect(accountLinkingService.handleOAuthSignIn).toHaveBeenCalledWith(
        identity.profile,
        identity.encryptedAccessToken,
        identity.encryptedRefreshToken,
      );
      expect(tokenIssuanceService.issueTokenPair).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({ status: 'authenticated', tokens: FAKE_TOKENS });
      expect(emailSender.sendAccountLinkConfirmation).not.toHaveBeenCalled();
    });

    it('issues tokens on a SIGNUP outcome', async () => {
      const identity = buildIdentity();
      const user = buildUser({ id: 'new-user' });
      accountLinkingService.handleOAuthSignIn.mockResolvedValueOnce({ kind: 'SIGNUP', user });
      tokenIssuanceService.issueTokenPair.mockResolvedValueOnce(FAKE_TOKENS);

      const result = await controller.googleCallback(buildRequest(identity));

      expect(tokenIssuanceService.issueTokenPair).toHaveBeenCalledWith('new-user');
      expect(result).toEqual({ status: 'authenticated', tokens: FAKE_TOKENS });
    });

    it('emails a confirmation link and does NOT leak the token on PENDING_CONFIRMATION (Google)', async () => {
      const identity = buildIdentity({ provider: OAuthProvider.GOOGLE });
      accountLinkingService.handleOAuthSignIn.mockResolvedValueOnce({
        kind: 'PENDING_CONFIRMATION',
        candidateUserId: 'user-1',
        candidateEmail: 'jane.doe@example.com',
        confirmationToken: 'confirm-abc',
      });

      const result = await controller.googleCallback(buildRequest(identity));

      expect(emailSender.sendAccountLinkConfirmation).toHaveBeenCalledWith(
        'jane.doe@example.com',
        'http://localhost:3000/auth/google/link?token=confirm-abc',
      );
      expect(result).toEqual({
        status: 'confirmation_required',
        message: expect.any(String),
      });
      // Critical: the raw token must never appear in the API response.
      expect(JSON.stringify(result)).not.toContain('confirm-abc');
      expect(tokenIssuanceService.issueTokenPair).not.toHaveBeenCalled();
    });

    it('builds a linkedin link path on PENDING_CONFIRMATION (LinkedIn)', async () => {
      const identity = buildIdentity({ provider: OAuthProvider.LINKEDIN });
      accountLinkingService.handleOAuthSignIn.mockResolvedValueOnce({
        kind: 'PENDING_CONFIRMATION',
        candidateUserId: 'user-1',
        candidateEmail: 'jane.doe@example.com',
        confirmationToken: 'confirm-xyz',
      });

      await controller.linkedinCallback(buildRequest(identity));

      expect(emailSender.sendAccountLinkConfirmation).toHaveBeenCalledWith(
        'jane.doe@example.com',
        'http://localhost:3000/auth/linkedin/link?token=confirm-xyz',
      );
    });
  });

  describe('googleCallback — link-confirmation path (state present)', () => {
    it('calls confirmPendingLink instead of handleOAuthSignIn when state is present', async () => {
      const identity = buildIdentity();
      const linkedUser = buildUser();
      accountLinkingService.confirmPendingLink.mockResolvedValueOnce(linkedUser);
      tokenIssuanceService.issueTokenPair.mockResolvedValueOnce(FAKE_TOKENS);

      const result = await controller.googleCallback(
        buildRequest(identity, { state: 'confirm-abc' }),
      );

      expect(accountLinkingService.confirmPendingLink).toHaveBeenCalledWith(
        'confirm-abc',
        identity.profile,
        identity.encryptedAccessToken,
        identity.encryptedRefreshToken,
      );
      expect(accountLinkingService.handleOAuthSignIn).not.toHaveBeenCalled();
      expect(tokenIssuanceService.issueTokenPair).toHaveBeenCalledWith(linkedUser.id);
      expect(result).toEqual({ status: 'authenticated', tokens: FAKE_TOKENS });
    });

    it('ignores an empty-string state and falls back to fresh sign-in', async () => {
      const identity = buildIdentity();
      const user = buildUser();
      accountLinkingService.handleOAuthSignIn.mockResolvedValueOnce({ kind: 'LOGIN', user });
      tokenIssuanceService.issueTokenPair.mockResolvedValueOnce(FAKE_TOKENS);

      await controller.googleCallback(buildRequest(identity, { state: '' }));

      expect(accountLinkingService.handleOAuthSignIn).toHaveBeenCalled();
      expect(accountLinkingService.confirmPendingLink).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('delegates to TokenIssuanceService.rotateRefreshToken and returns the new pair', async () => {
      tokenIssuanceService.rotateRefreshToken.mockResolvedValueOnce(FAKE_TOKENS);

      const result = await controller.refresh({ refreshToken: 'old-refresh-token' });

      expect(tokenIssuanceService.rotateRefreshToken).toHaveBeenCalledWith('old-refresh-token');
      expect(result).toEqual(FAKE_TOKENS);
    });
  });

  describe('guard-only entrypoints', () => {
    it('googleLogin, linkedinLogin, googleLinkStart, linkedinLinkStart are no-ops (guard handles the redirect)', () => {
      expect(controller.googleLogin()).toBeUndefined();
      expect(controller.linkedinLogin()).toBeUndefined();
      expect(controller.googleLinkStart()).toBeUndefined();
      expect(controller.linkedinLinkStart()).toBeUndefined();
    });
  });
});
