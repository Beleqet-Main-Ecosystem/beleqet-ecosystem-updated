import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { AuditLogService } from '../audit-log.service';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditLogService: jest.Mocked<AuditLogService>;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    auditLogService = {
      createLog: jest.fn().mockResolvedValue({ id: 'log-100' }),
    } as unknown as jest.Mocked<AuditLogService>;

    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    interceptor = new AuditInterceptor(reflector, auditLogService);
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should intercept HTTP request and asynchronously log audit entry', (done) => {
    const mockRequest = {
      method: 'POST',
      url: '/api/v1/jobs',
      body: { title: 'Test Job' },
      headers: { 'user-agent': 'Jest-Tester', 'x-forwarded-for': '127.0.0.1' },
      user: { id: 'usr-44' },
      params: {},
    };

    const mockExecutionContext = {
      getType: jest.fn().mockReturnValue('http'),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of({ id: 'job-99', title: 'Test Job' }),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      next: (val) => {
        expect(val).toEqual({ id: 'job-99', title: 'Test Job' });
      },
      complete: () => {
        setImmediate(() => {
          expect(auditLogService.createLog).toHaveBeenCalledTimes(1);
          expect(auditLogService.createLog).toHaveBeenCalledWith(
            expect.objectContaining({
              userId: 'usr-44',
              action: 'POST /api/v1/jobs',
              entity: 'JOBS',
              ipAddress: '127.0.0.1',
              userAgent: 'Jest-Tester',
            }),
          );
          done();
        });
      },
    });
  });

  it('should use @AuditAction decorator metadata when present', (done) => {
    reflector.getAllAndOverride.mockReturnValue({
      action: 'CUSTOM_JOB_ACTION',
      entity: 'CUSTOM_JOB_ENTITY',
    });

    const mockRequest = {
      method: 'POST',
      url: '/api/v1/jobs',
      body: {},
      headers: {},
      params: { id: 'job-55' },
    };

    const mockExecutionContext = {
      getType: jest.fn().mockReturnValue('http'),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    const mockCallHandler: CallHandler = {
      handle: () => of({ status: 'ok' }),
    };

    interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
      complete: () => {
        setImmediate(() => {
          expect(auditLogService.createLog).toHaveBeenCalledWith(
            expect.objectContaining({
              action: 'CUSTOM_JOB_ACTION',
              entity: 'CUSTOM_JOB_ENTITY',
              entityId: 'job-55',
            }),
          );
          done();
        });
      },
    });
  });
});
