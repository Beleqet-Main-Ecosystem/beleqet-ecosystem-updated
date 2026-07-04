/**
 * @file all-exceptions.filter.spec.ts
 * @description Unit tests for AllExceptionsFilter.
 *
 * The filter depends on HttpAdapterHost and ErrorRecurrenceTrackerService.
 * Both are provided as mocks so no HTTP server or database is required.
 */
import {
  HttpException,
  HttpStatus,
  ArgumentsHost,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter, ERROR_CODES, ErrorResponse } from './all-exceptions.filter';
import { ErrorRecurrenceTrackerService } from './error-recurrence-tracker.service';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers to build mock ArgumentsHost
// ─────────────────────────────────────────────────────────────────────────────

function buildMockHost(url = '/api/v1/jobs', method = 'GET'): ArgumentsHost {
  const mockRequest  = { url, method };
  const mockResponse = {};

  const mockHttpContext = {
    getRequest:  () => mockRequest,
    getResponse: () => mockResponse,
  };

  return {
    switchToHttp: () => mockHttpContext,
  } as unknown as ArgumentsHost;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prisma-like error helper
// ─────────────────────────────────────────────────────────────────────────────
function prismaError(code: string, msg = `Prisma error ${code}`) {
  const err = new Error(msg) as Error & { code: string; clientVersion: string };
  err.code          = code;
  err.clientVersion = '5.0.0';
  return err;
}

// ─────────────────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────────────────
describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockReply: jest.Mock;
  let mockAdapterHost: HttpAdapterHost;
  let mockTracker: { track: jest.Mock };

  beforeEach(() => {
    mockReply = jest.fn();
    mockAdapterHost = {
      httpAdapter: { reply: mockReply },
    } as unknown as HttpAdapterHost;

    mockTracker = { track: jest.fn() };

    filter = new AllExceptionsFilter(
      mockAdapterHost,
      mockTracker as unknown as ErrorRecurrenceTrackerService,
    );
  });

  afterEach(() => jest.clearAllMocks());

  // ──────────────────────────────────────────────────────────────────────────
  // HTTP exceptions
  // ──────────────────────────────────────────────────────────────────────────
  describe('HttpException handling', () => {
    it('maps 404 to ERR_RESOURCE_NOT_FOUND', () => {
      const host = buildMockHost('/api/v1/jobs/999');
      filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);

      const [, body, status] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(status).toBe(404);
      expect(body.errorCode).toBe(ERROR_CODES.NOT_FOUND);
    });

    it('maps 401 to ERR_UNAUTHORIZED', () => {
      const host = buildMockHost('/api/v1/auth/me');
      filter.catch(new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED), host);

      const [, body, status] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(status).toBe(401);
      expect(body.errorCode).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('maps 403 to ERR_FORBIDDEN', () => {
      const host = buildMockHost('/api/v1/admin/db-index/report');
      filter.catch(new HttpException('Forbidden', HttpStatus.FORBIDDEN), host);

      const [, body] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(body.errorCode).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('maps 400 to ERR_BAD_REQUEST', () => {
      const host = buildMockHost();
      filter.catch(new HttpException('Bad request', HttpStatus.BAD_REQUEST), host);

      const [, body] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(body.errorCode).toBe(ERROR_CODES.BAD_REQUEST);
    });

    it('maps 409 to ERR_CONFLICT', () => {
      const host = buildMockHost();
      filter.catch(new HttpException('Conflict', HttpStatus.CONFLICT), host);

      const [, body] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(body.errorCode).toBe(ERROR_CODES.CONFLICT);
    });

    it('maps 429 to ERR_RATE_LIMIT_EXCEEDED', () => {
      const host = buildMockHost();
      filter.catch(new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS), host);

      const [, body] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(body.errorCode).toBe(ERROR_CODES.TOO_MANY_REQUESTS);
    });

    it('joins array validation messages with semicolons', () => {
      const host = buildMockHost();
      const resp = { message: ['email must be an email', 'password too short'] };
      filter.catch(
        new HttpException(resp, HttpStatus.BAD_REQUEST),
        host,
      );

      const [, body] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(body.message).toContain('email must be an email');
      expect(body.message).toContain('password too short');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Prisma errors
  // ──────────────────────────────────────────────────────────────────────────
  describe('Prisma error handling', () => {
    it('maps P2002 (unique) to 409 ERR_DUPLICATE_RECORD', () => {
      const host = buildMockHost();
      filter.catch(prismaError('P2002'), host);

      const [, body, status] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(status).toBe(409);
      expect(body.errorCode).toBe(ERROR_CODES.DB_UNIQUE_VIOLATION);
    });

    it('maps P2025 (not found) to 404 ERR_RECORD_NOT_FOUND', () => {
      const host = buildMockHost();
      filter.catch(prismaError('P2025'), host);

      const [, body, status] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(status).toBe(404);
      expect(body.errorCode).toBe(ERROR_CODES.DB_RECORD_NOT_FOUND);
    });

    it('maps P2003 (foreign key) to 422 ERR_REFERENTIAL_INTEGRITY', () => {
      const host = buildMockHost();
      filter.catch(prismaError('P2003'), host);

      const [, body, status] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(status).toBe(422);
      expect(body.errorCode).toBe(ERROR_CODES.DB_FOREIGN_KEY_VIOLATION);
    });

    it('maps P1001 (DB unreachable) to 503 ERR_DB_UNAVAILABLE', () => {
      const host = buildMockHost();
      filter.catch(prismaError('P1001'), host);

      const [, body, status] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(status).toBe(503);
      expect(body.errorCode).toBe(ERROR_CODES.DB_CONNECTION);
    });

    it('maps P1002 (DB timeout) to 503', () => {
      const host = buildMockHost();
      filter.catch(prismaError('P1002'), host);

      const [, , status] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(status).toBe(503);
    });

    it('maps unknown Prisma code to 500 ERR_INTERNAL', () => {
      const host = buildMockHost();
      filter.catch(prismaError('P9999'), host);

      const [, body, status] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(status).toBe(500);
      expect(body.errorCode).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Generic errors
  // ──────────────────────────────────────────────────────────────────────────
  describe('Generic error handling', () => {
    it('maps a plain Error to 500 ERR_INTERNAL', () => {
      const host = buildMockHost();
      filter.catch(new Error('something exploded'), host);

      const [, body, status] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(status).toBe(500);
      expect(body.errorCode).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR);
    });

    it('maps a non-Error throw to 500 ERR_UNKNOWN', () => {
      const host = buildMockHost();
      filter.catch('raw string thrown', host);

      const [, body, status] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(status).toBe(500);
      expect(body.errorCode).toBe(ERROR_CODES.UNKNOWN);
    });

    it('handles null throw gracefully', () => {
      const host = buildMockHost();
      expect(() => filter.catch(null, host)).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Response shape
  // ──────────────────────────────────────────────────────────────────────────
  describe('response body structure', () => {
    it('includes all required fields', () => {
      const host = buildMockHost('/api/v1/jobs', 'POST');
      filter.catch(new HttpException('Bad request', HttpStatus.BAD_REQUEST), host);

      const [, body] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(body).toHaveProperty('statusCode');
      expect(body).toHaveProperty('errorCode');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('path');
      expect(body).toHaveProperty('traceId');
    });

    it('includes a non-empty traceId', () => {
      const host = buildMockHost();
      filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);

      const [, body] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(typeof body.traceId).toBe('string');
      expect(body.traceId.length).toBeGreaterThan(0);
    });

    it('path in response matches request URL', () => {
      const host = buildMockHost('/api/v1/users/me');
      filter.catch(new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED), host);

      const [, body] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(body.path).toBe('/api/v1/users/me');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GDPR: PII redaction in path
  // ──────────────────────────────────────────────────────────────────────────
  describe('GDPR PII redaction', () => {
    it('redacts email query param from the logged path', () => {
      const host = buildMockHost('/auth/verify?token=secret123&email=john@example.com');
      filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);

      const [, body] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(body.path).not.toContain('secret123');
      expect(body.path).not.toContain('john@example.com');
      expect(body.path).toContain('[REDACTED]');
    });

    it('preserves non-sensitive query params', () => {
      const host = buildMockHost('/jobs?status=PUBLISHED&limit=20');
      filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);

      const [, body] = mockReply.mock.calls[0] as [unknown, ErrorResponse, number];
      expect(body.path).toContain('status=PUBLISHED');
      expect(body.path).toContain('limit=20');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Recurrence tracker delegation
  // ──────────────────────────────────────────────────────────────────────────
  describe('recurrence tracker delegation', () => {
    it('calls tracker.track() on every exception', () => {
      const host = buildMockHost();
      filter.catch(new Error('boom'), host);

      expect(mockTracker.track).toHaveBeenCalledTimes(1);
    });

    it('passes the correct errorCode to the tracker', () => {
      const host = buildMockHost();
      filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);

      const [calledCode] = mockTracker.track.mock.calls[0] as [string, string, string];
      expect(calledCode).toBe(ERROR_CODES.NOT_FOUND);
    });
  });
});
