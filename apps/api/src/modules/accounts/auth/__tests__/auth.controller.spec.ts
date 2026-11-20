// 1. HOISTED MOCK
jest.mock('otplib', () => ({
  generateSecret: jest.fn(),
  generateURI: jest.fn(),
  verify: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { RegisterDto } from '../dto/register.dto';

// 2. IMPORT REAL TOKENS & SERVICES
import { AccountLinkingService } from '../services/account-linking.service';
import { EMAIL_SENDER } from '../interfaces/email-sender.interface';
import { AUTH_ENV_CONFIG } from '../config/auth.config';

const MOCK_ROLE = 'JOB_SEEKER' as any;

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<
    Pick<
      AuthService,
      | 'issueTokensForUserId'
      | 'refresh'
      | 'validateUser'
      | 'login'
      | 'passwordLogin'
      | 'register'
      | 'logout'
      | 'verifyEmail'
      | 'forgotPassword'
      | 'resetPassword'
      | 'changePassword'
      | 'changeEmail'
    >
  >;

  const FAKE_TOKENS = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    user: {
      id: 'user-id-123',
      email: 'test@beleqet.com',
      firstName: 'Test',
      lastName: 'User',
      role: MOCK_ROLE,
    },
  };

  const FAKE_USER = {
    id: 'user-id-123',
    email: 'test@beleqet.com',
    firstName: 'Test',
    lastName: 'User',
    role: MOCK_ROLE,
  };

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      validateUser: jest.fn(),
      login: jest.fn(),
      passwordLogin: jest.fn(),
      refresh: jest.fn(),
      issueTokensForUserId: jest.fn(),
      logout: jest.fn(),
      verifyEmail: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
      changeEmail: jest.fn(),
      oauthSession: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        // 3. USE ACTUAL CLASSES AND CONSTANTS
        {
          provide: AccountLinkingService,
          useValue: {
            confirmPendingLink: jest.fn(),
            handleOAuthSignIn: jest.fn(),
          },
        },
        {
          provide: EMAIL_SENDER,
          useValue: { sendAccountLinkConfirmation: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: AUTH_ENV_CONFIG,
          useValue: { appBaseUrl: 'http://localhost:3000', frontendUrl: 'https://web.test' },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a user and ask for the emailed code (no session yet)', async () => {
      const dto: RegisterDto = {
        email: 'test@beleqet.com',
        password: 'password123!',
        firstName: 'Test',
        lastName: 'User',
        role: MOCK_ROLE,
      };

      const challenge = {
        requiresEmailVerification: true as const,
        verificationToken: 'ticket',
        email: dto.email,
      };
      authService.register.mockResolvedValueOnce(challenge);

      const result = await controller.register(dto);
      expect(result).toEqual(challenge);
      expect(authService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should validate credentials, log in user, and issue tokens when 2FA is off', async () => {
      const loginDto = { email: 'test@beleqet.com', password: 'password123!' };
      const req = { headers: { 'user-agent': 'Mozilla/5.0' } };

      authService.validateUser.mockResolvedValueOnce(FAKE_USER as any);
      authService.passwordLogin.mockResolvedValueOnce(FAKE_TOKENS);

      const result = await controller.login(loginDto, req as any);

      expect(result).toEqual(FAKE_TOKENS);
      expect(authService.validateUser).toHaveBeenCalledWith(loginDto.email, loginDto.password);
      expect(authService.passwordLogin).toHaveBeenCalledWith(FAKE_USER, req.headers['user-agent']);
    });
  });

  describe('refresh', () => {
    it('should accept a valid refresh token and rotate it', async () => {
      const body = { refreshToken: 'old-refresh-token' };
      authService.refresh.mockResolvedValueOnce(FAKE_TOKENS);

      const result = await controller.refresh(body);

      expect(result).toEqual(FAKE_TOKENS);
      expect(authService.refresh).toHaveBeenCalledWith(body.refreshToken);
    });
  });
});

describe('AuthController OAuth callbacks', () => {
  async function setup(session: unknown, outcome: unknown) {
    const oauthSession = jest.fn().mockResolvedValue(session);
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: { oauthSession } },
        {
          provide: AccountLinkingService,
          useValue: {
            confirmPendingLink: jest.fn(),
            handleOAuthSignIn: jest.fn().mockResolvedValue(outcome),
          },
        },
        {
          provide: EMAIL_SENDER,
          useValue: { sendAccountLinkConfirmation: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: AUTH_ENV_CONFIG,
          useValue: { appBaseUrl: 'http://api.test', frontendUrl: 'https://web.test' },
        },
      ],
    }).compile();
    const controller = module.get<AuthController>(AuthController);
    const res = { redirect: jest.fn() };
    const req = { user: { profile: { provider: 'GOOGLE' } }, query: {} };
    await controller.googleCallback(req as any, res as any);
    return res.redirect.mock.calls[0][0] as string;
  }

  it('sends a signed-in person to the website with tokens in the fragment', async () => {
    const url = await setup(
      { accessToken: 'a.b.c', refreshToken: 'r1', user: {} },
      { kind: 'LOGIN', user: { id: 'u1' } },
    );
    expect(url).toBe('https://web.test/auth/callback#access=a.b.c&refresh=r1');
  });

  it('asks for the two-step code when the account has it on', async () => {
    const url = await setup(
      { requires2fa: true, tempToken: 't1' },
      { kind: 'LOGIN', user: { id: 'u1' } },
    );
    expect(url).toBe('https://web.test/auth/callback#twoFactor=t1');
  });

  it('sends a pending link to the sign-in page to check email', async () => {
    const url = await setup(null, {
      kind: 'PENDING_CONFIRMATION',
      candidateEmail: 'a@b.c',
      confirmationToken: 'x',
    });
    expect(url).toBe('https://web.test/login?oauth=confirm');
  });
});
