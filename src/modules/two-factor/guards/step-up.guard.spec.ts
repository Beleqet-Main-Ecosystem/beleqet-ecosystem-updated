import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { StepUpGuard } from './step-up.guard';
import { SENSITIVE_ACTION_KEY } from '../decorators/sensitive-action.decorator';

const mockConfig = {
  get: jest.fn((key: string, defaultValue?: any) => {
    const values: Record<string, any> = {
      TOTP_TEMP_SECRET: 'test-temp-secret',
      JWT_ACCESS_SECRET: 'test-jwt-secret',
    };
    return values[key] ?? defaultValue;
  }),
};

const validStepUpPayload = {
  sub: 'user-1',
  purpose: '2fa_step_up',
  '2fa_verified_at': Math.floor(Date.now() / 1000),
  iat: Math.floor(Date.now() / 1000),
};

const validAccessPayload = {
  sub: 'user-1',
  email: 'test@example.com',
  role: 'JOB_SEEKER',
};

const mockPrisma = {
  userTwoFactor: {
    findUnique: jest.fn(),
  },
} as any;

describe('StepUpGuard', () => {
  let guard: StepUpGuard;
  let reflector: Reflector;
  let jwtService: JwtService;
  let mockRequest: any;
  let mockContext: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StepUpGuard,
        Reflector,
        { provide: JwtService, useValue: { verify: jest.fn(), sign: jest.fn().mockReturnValue('challenge-token') } },
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    guard = module.get<StepUpGuard>(StepUpGuard);
    reflector = module.get<Reflector>(Reflector);
    jwtService = module.get<JwtService>(JwtService);

    mockRequest = { headers: {} };
    mockContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;
  });

  function mockReflectorForSensitiveOnly() {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === SENSITIVE_ACTION_KEY) return true;
      return undefined;
    });
  }

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow non-sensitive routes', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    await expect(guard.canActivate(mockContext)).resolves.toBe(true);
  });

  it('should reject sensitive route with no auth header', async () => {
    mockReflectorForSensitiveOnly();
    mockRequest.headers = {};
    await expect(guard.canActivate(mockContext)).rejects.toThrow();
  });

  it('should reject sensitive route with invalid token', async () => {
    mockReflectorForSensitiveOnly();
    jest.spyOn(jwtService, 'verify').mockImplementation(() => {
      throw new Error('invalid');
    });
    mockRequest.headers = { authorization: 'Bearer invalid-token' };
    await expect(guard.canActivate(mockContext)).rejects.toThrow();
  });

  it('should return true with valid step-up token and set request.user', async () => {
    mockReflectorForSensitiveOnly();
    jest.spyOn(jwtService, 'verify').mockReturnValue(validStepUpPayload);
    mockRequest.headers = { authorization: 'Bearer valid-step-up-token' };
    await expect(guard.canActivate(mockContext)).resolves.toBe(true);
    expect(mockRequest.user).toEqual({ userId: 'user-1' });
  });

  it('should throw with expired step-up token', async () => {
    mockReflectorForSensitiveOnly();
    jest.spyOn(jwtService, 'verify').mockReturnValue({
      ...validStepUpPayload,
      '2fa_verified_at': Math.floor(Date.now() / 1000) - 1800,
    });
    mockRequest.headers = { authorization: 'Bearer expired-step-up-token' };
    mockRequest.user = { userId: 'user-1' };
    await expect(guard.canActivate(mockContext)).rejects.toThrow();
  });

  it('should reject step-up token with mismatched action scope', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === SENSITIVE_ACTION_KEY) return true;
      if (key === 'action_type') return 'milestone_release';
      return undefined;
    });
    jest.spyOn(jwtService, 'verify').mockReturnValue({
      ...validStepUpPayload,
      action: 'wallet_withdraw',
    });
    mockRequest.headers = { authorization: 'Bearer scoped-step-up-token' };
    await expect(guard.canActivate(mockContext)).rejects.toThrow();
  });

  it('should pass step-up token when action scope matches route', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === SENSITIVE_ACTION_KEY) return true;
      if (key === 'action_type') return 'wallet_withdraw';
      return undefined;
    });
    jest.spyOn(jwtService, 'verify').mockReturnValue({
      ...validStepUpPayload,
      action: 'wallet_withdraw',
    });
    mockRequest.headers = { authorization: 'Bearer scoped-step-up-token' };
    await expect(guard.canActivate(mockContext)).resolves.toBe(true);
  });

  it('should return challenge when access token has no step-up and 2FA enabled', async () => {
    mockReflectorForSensitiveOnly();

    let callCount = 0;
    jest.spyOn(jwtService, 'verify').mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error('invalid');
      return validAccessPayload;
    });
    mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
      enabled: true,
    });
    mockRequest.headers = { authorization: 'Bearer access-token' };
    await expect(guard.canActivate(mockContext)).rejects.toThrow();
  });

  it('should pass when access token has no step-up and 2FA disabled', async () => {
    mockReflectorForSensitiveOnly();

    let callCount = 0;
    jest.spyOn(jwtService, 'verify').mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error('invalid');
      return validAccessPayload;
    });
    mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
      enabled: false,
    });
    mockRequest.headers = { authorization: 'Bearer access-token' };
    await expect(guard.canActivate(mockContext)).resolves.toBe(true);
  });

  it('should pass when access token has no step-up and no 2FA record', async () => {
    mockReflectorForSensitiveOnly();

    let callCount = 0;
    jest.spyOn(jwtService, 'verify').mockImplementation(() => {
      callCount++;
      if (callCount === 1) throw new Error('invalid');
      return validAccessPayload;
    });
    mockPrisma.userTwoFactor.findUnique.mockResolvedValue(null);
    mockRequest.headers = { authorization: 'Bearer access-token' };
    await expect(guard.canActivate(mockContext)).resolves.toBe(true);
  });
});
