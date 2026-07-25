import { of, throwError } from 'rxjs';
import { AuditInterceptor } from './audit.interceptor';
import { AuditLoggingService } from '../audit-logging.service';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditLoggingService: { createSafe: jest.Mock };

  beforeEach(() => {
    auditLoggingService = { createSafe: jest.fn().mockResolvedValue(undefined) };
    interceptor = new AuditInterceptor(
      auditLoggingService as unknown as AuditLoggingService,
    );
  });

  it('skips health and audit-log paths', () => {
    expect(interceptor.shouldSkip('/api/v1/health')).toBe(true);
    expect(interceptor.shouldSkip('/admin/audit-logs')).toBe(true);
    expect(interceptor.shouldSkip('/docs')).toBe(true);
    expect(interceptor.shouldSkip('/api/v1/jobs')).toBe(false);
  });

  it('persists an HTTP_REQUEST audit on success', (done) => {
    const req = {
      method: 'POST',
      originalUrl: '/api/v1/jobs?x=1',
      url: '/api/v1/jobs?x=1',
      path: '/api/v1/jobs',
      body: { title: 'Job', password: 'secret' },
      query: {},
      headers: { 'x-forwarded-for': '203.0.113.10' },
      ip: '127.0.0.1',
      user: { userId: 'admin-1', role: 'ADMIN' },
      socket: { remoteAddress: '127.0.0.1' },
    };
    const res = { statusCode: 201 };

    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    };

    interceptor.intercept(context as never, { handle: () => of({ ok: true }) }).subscribe({
      next: async () => {
        await Promise.resolve();
        expect(auditLoggingService.createSafe).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: 'HTTP_REQUEST',
            entityType: 'HttpRequest',
            actorUserId: 'admin-1',
            httpMethod: 'POST',
            path: '/api/v1/jobs',
            statusCode: 201,
            payload: expect.objectContaining({
              body: expect.objectContaining({ password: '[REDACTED]' }),
            }),
          }),
        );
        done();
      },
      error: done,
    });
  });

  it('does not intercept non-http contexts', (done) => {
    const context = { getType: () => 'rpc' };
    interceptor.intercept(context as never, { handle: () => of('ok') }).subscribe({
      next: () => {
        expect(auditLoggingService.createSafe).not.toHaveBeenCalled();
        done();
      },
      error: done,
    });
  });

  it('records status from thrown errors', (done) => {
    const req = {
      method: 'GET',
      originalUrl: '/api/v1/users',
      url: '/api/v1/users',
      path: '/api/v1/users',
      body: {},
      query: {},
      headers: {},
      ip: '10.0.0.2',
      socket: { remoteAddress: '10.0.0.2' },
    };
    const res = { statusCode: 200 };
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    };

    interceptor
      .intercept(context as never, {
        handle: () => throwError(() => ({ status: 403 })),
      })
      .subscribe({
        error: async () => {
          await Promise.resolve();
          expect(auditLoggingService.createSafe).toHaveBeenCalledWith(
            expect.objectContaining({ statusCode: 403 }),
          );
          done();
        },
      });
  });
});
