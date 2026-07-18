import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from '../audit.service';
import { AUDIT_LOG_KEY } from '../decorators/audit-log.decorator';

const mockAuditService = {
  log: jest.fn(),
};

function buildContext(user?: { userId: string; role: string }): ExecutionContext {
  const req = { method: 'POST', originalUrl: '/api/v1/auth/login', user };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext;
}

function buildCallHandler(): CallHandler {
  return { handle: () => of({ ok: true }) };
}

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditInterceptor,
        Reflector,
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    interceptor = module.get<AuditInterceptor>(AuditInterceptor);
    reflector = module.get<Reflector>(Reflector);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should skip logging when the handler has no @AuditLog metadata', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);
    const context = buildContext({ userId: 'user-1', role: 'ADMIN' });

    interceptor.intercept(context, buildCallHandler()).subscribe(() => {
      expect(mockAuditService.log).not.toHaveBeenCalled();
      done();
    });
  });

  it('should log using the authenticated user id when @AuditLog metadata is present', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue('USER_LOGIN');
    const context = buildContext({ userId: 'user-1', role: 'ADMIN' });

    interceptor.intercept(context, buildCallHandler()).subscribe(() => {
      expect(mockAuditService.log).toHaveBeenCalledWith(
        'USER_LOGIN',
        'user-1',
        expect.objectContaining({ method: 'POST', path: '/api/v1/auth/login' }),
      );
      done();
    });
  });

  it('should fall back to "anonymous" as the actor when no user is present on the request', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue('USER_LOGIN_FAILED');
    const context = buildContext(undefined);

    interceptor.intercept(context, buildCallHandler()).subscribe(() => {
      expect(mockAuditService.log).toHaveBeenCalledWith(
        'USER_LOGIN_FAILED',
        'anonymous',
        expect.any(Object),
      );
      done();
    });
  });

  it('should not log when the handler throws (only successful responses are audited)', (done) => {
    jest.spyOn(reflector, 'get').mockReturnValue('USER_LOGIN');
    const context = buildContext({ userId: 'user-1', role: 'ADMIN' });
    const throwingHandler: CallHandler = {
      handle: () => new (require('rxjs').Observable)((subscriber: any) => {
        subscriber.error(new Error('boom'));
      }),
    };

    interceptor.intercept(context, throwingHandler).subscribe({
      error: () => {
        expect(mockAuditService.log).not.toHaveBeenCalled();
        done();
      },
    });
  });
});
