import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { AccountLinkingService } from '../services/account-linking.service';
import { EMAIL_SENDER, IEmailSender } from '../interfaces/email-sender.interface';
import { AUTH_ENV_CONFIG } from '../config/auth.config';
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

const FAKE_TOKENS = { accessToken: 'access.jwt', refreshToken: 'refresh-raw' };

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<
    Pick<AuthService, 'issueTokensForUserId' | 'refresh' | 'validateUser' | 'login' | 'register'>
  >;
  let accountLinkingService: jest.Mocked<
    Pick<AccountLinkingService, 'handleOAuthSignIn' | 'confirmPendingLink'>
  >;
  let emailSender: jest.Mocked<IEmailSender>;

  beforeEach(async () => {
    authService = {
      issueTokensForUserId: jest.fn(),
      refresh: jest.fn(),
      validateUser: jest.fn(),
      login: jest.fn(),
      register: jest.fn(),
    };
    accountLinkingService = {
      handleOAuthSignIn: jest.fn(),
      confirmPendingLink: jest.fn(),
    };
    emailSender = { sendAccountLinkConfirmation: jest.fn().mockResolvedValue(undefined) };

    const config: Pick<AuthEnvConfig, 'appBaseUrl'> = {
      appBaseUrl: 'http://localhost:3000',
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: AccountLinkingService, useValue: accountLinkingService },
        { provide: EMAIL_SENDER, useValue: emailSender },
        { provide: AUTH_ENV_CONFIG, useValue: config },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('googleCallback / linkedinCallback — fresh sign-in path', () => {
    it('issues tokens on a LOGIN outcome via AuthService', async () => {
      const identity = buildIdentity();
      const user = buildUser();
      accountLinkingService.handleOAuthSignIn.mockResolvedValueOnce({ kind: 'LOGIN', user });
      authService.issueTokensForUserId.mockResolvedValueOnce(FAKE_TOKENS as never);

      const result = await controller.googleCallback(buildRequest(identity));

      expect(authService.issueTokensForUserId).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({ status: 'authenticated', tokens: FAKE_TOKENS });
    });

    it('issues tokens on a SIGNUP outcome', async () => {
      const identity = buildIdentity();
      const user = buildUser({ id: 'new-user' });
      accountLinkingService.handleOAuthSignIn.mockResolvedValueOnce({ kind: 'SIGNUP', user });
      authService.issueTokensForUserId.mockResolvedValueOnce(FAKE_TOKENS as never);

      const result = await controller.googleCallback(buildRequest(identity));

      expect(authService.issueTokensForUserId).toHaveBeenCalledWith('new-user');
      expect(result).toEqual({ status: 'authenticated', tokens: FAKE_TOKENS });
    });

    it('emails a confirmation link and does NOT leak the token on PENDING_CONFIRMATION', async () => {
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
      expect(result).toEqual({ status: 'confirmation_required', message: expect.any(String) });
      expect(JSON.stringify(result)).not.toContain('confirm-abc');
      expect(authService.issueTokensForUserId).not.toHaveBeenCalled();
    });
  });

  describe('googleCallback — link-confirmation path (state present)', () => {
    it('calls confirmPendingLink instead of handleOAuthSignIn when state is present', async () => {
      const identity = buildIdentity();
      const linkedUser = buildUser();
      accountLinkingService.confirmPendingLink.mockResolvedValueOnce(linkedUser);
      authService.issueTokensForUserId.mockResolvedValueOnce(FAKE_TOKENS as never);

      const result = await controller.googleCallback(
        buildRequest(identity, { state: 'link:confirm-abc' }),
      );

      expect(accountLinkingService.confirmPendingLink).toHaveBeenCalledWith(
        'confirm-abc',
        identity.profile,
        identity.encryptedAccessToken,
        identity.encryptedRefreshToken,
      );
      expect(accountLinkingService.handleOAuthSignIn).not.toHaveBeenCalled();
      expect(authService.issueTokensForUserId).toHaveBeenCalledWith(linkedUser.id);
      expect(result).toEqual({ status: 'authenticated', tokens: FAKE_TOKENS });
    });

    it('ignores a state without the "link:" prefix (e.g. the provider\'s own CSRF state) and treats it as a fresh sign-in', async () => {
      const identity = buildIdentity();
      const user = buildUser();
      accountLinkingService.handleOAuthSignIn.mockResolvedValueOnce({ kind: 'LOGIN', user });
      authService.issueTokensForUserId.mockResolvedValueOnce(FAKE_TOKENS as never);

      await controller.googleCallback(
        buildRequest(identity, { state: 'some-provider-csrf-nonce' }),
      );

      expect(accountLinkingService.handleOAuthSignIn).toHaveBeenCalled();
      expect(accountLinkingService.confirmPendingLink).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('delegates to AuthService.refresh (the single unified refresh path)', async () => {
      authService.refresh.mockResolvedValueOnce(FAKE_TOKENS as never);

      const result = await controller.refresh({ refreshToken: 'old-refresh-token' });

      expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');
      expect(result).toEqual(FAKE_TOKENS);
    });
  });

  describe('guard-only entrypoints', () => {
    it('googleLogin, linkedinLogin, googleLinkStart, linkedinLinkStart are no-ops', () => {
      expect(controller.googleLogin()).toBeUndefined();
      expect(controller.linkedinLogin()).toBeUndefined();
      expect(controller.googleLinkStart()).toBeUndefined();
      expect(controller.linkedinLinkStart()).toBeUndefined();
    });
  });
});
