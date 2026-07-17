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
import { UnauthorizedException } from '@nestjs/common';

// 2. IMPORT REAL TOKENS & SERVICES
import { AccountLinkingService } from '../services/account-linking.service';
import { EMAIL_SENDER } from '../interfaces/email-sender.interface';
import { AUTH_ENV_CONFIG } from '../config/auth.config';

const MOCK_ROLE = 'JOB_SEEKER' as any;

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<
    Pick<AuthService, 'issueTokensForUserId' | 'refresh' | 'validateUser' | 'login' | 'register' | 'logout' | 'verifyEmail' | 'forgotPassword' | 'resetPassword' | 'changePassword' | 'changeEmail'>
  >;

  const FAKE_TOKENS = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
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
      refresh: jest.fn(),
      issueTokensForUserId: jest.fn(),
      logout: jest.fn(),
      verifyEmail: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      changePassword: jest.fn(),
      changeEmail: jest.fn(),
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
            handleOAuthSignIn: jest.fn() 
          } 
        },
        { provide: EMAIL_SENDER, useValue: { sendAccountLinkConfirmation: jest.fn().mockResolvedValue({}) } },
        { provide: AUTH_ENV_CONFIG, useValue: { appBaseUrl: 'http://localhost:3000' } },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('should register a user and return fresh tokens', async () => {
      const dto: RegisterDto = {
        email: 'test@beleqet.com',
        password: 'password123!',
        firstName: 'Test',
        lastName: 'User',
        role: MOCK_ROLE,
      };

      authService.register.mockResolvedValueOnce(FAKE_TOKENS);

      const result = await controller.register(dto);
      expect(result).toEqual(FAKE_TOKENS);
      expect(authService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('login', () => {
    it('should validate credentials, log in user, and issue tokens when 2FA is off', async () => {
      const loginDto = { email: 'test@beleqet.com', password: 'password123!' };
      const req = { headers: { 'user-agent': 'Mozilla/5.0' } };

      authService.validateUser.mockResolvedValueOnce(FAKE_USER as any);
      authService.login.mockResolvedValueOnce(FAKE_TOKENS);

      const result = await controller.login(loginDto, req as any);

      expect(result).toEqual(FAKE_TOKENS);
      expect(authService.validateUser).toHaveBeenCalledWith(loginDto.email, loginDto.password);
      expect(authService.login).toHaveBeenCalledWith(FAKE_USER, req.headers['user-agent']);
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