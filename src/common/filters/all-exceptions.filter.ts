/**
 * @file all-exceptions.filter.ts
 * @description
 * Enhanced global exception filter for the Beleqet platform.
 *
 * Features:
 *  ✓ Catches ALL exceptions (HTTP, Prisma, unexpected JS errors)
 *  ✓ Structured JSON logging (machine-parseable by log aggregators)
 *  ✓ i18n-ready error codes (e.g. "ERR_RESOURCE_NOT_FOUND") so the
 *    front-end can map codes to localised messages without relying on
 *    English text from the API.
 *  ✓ GDPR-safe output — raw error messages and stack traces are NEVER
 *    sent to clients in production; only sanitised, code-based responses.
 *  ✓ Distinguishes between operational errors (4xx) and system faults (5xx).
 *  ✓ Delegates recurring-error alerting to ErrorRecurrenceTrackerService.
 */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';
import { ErrorRecurrenceTrackerService } from './error-recurrence-tracker.service';

// ─────────────────────────────────────────────────────────────────────────────
// Prisma error type guard
// ─────────────────────────────────────────────────────────────────────────────
interface PrismaKnownError {
  code: string;
  clientVersion: string;
  meta?: Record<string, unknown>;
  message: string;
}

function isPrismaError(err: unknown): err is PrismaKnownError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as Record<string, unknown>)['code'] === 'string' &&
    String((err as Record<string, unknown>)['code']).startsWith('P')
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// i18n error-code catalogue
// Front-end maps these codes to locale-specific messages (Amharic, English…)
// ─────────────────────────────────────────────────────────────────────────────
export const ERROR_CODES = {
  // 4xx — operational
  BAD_REQUEST:              'ERR_BAD_REQUEST',
  UNAUTHORIZED:             'ERR_UNAUTHORIZED',
  FORBIDDEN:                'ERR_FORBIDDEN',
  NOT_FOUND:                'ERR_RESOURCE_NOT_FOUND',
  CONFLICT:                 'ERR_CONFLICT',
  UNPROCESSABLE:            'ERR_VALIDATION_FAILED',
  TOO_MANY_REQUESTS:        'ERR_RATE_LIMIT_EXCEEDED',
  // 5xx — system
  INTERNAL_SERVER_ERROR:    'ERR_INTERNAL',
  DB_UNIQUE_VIOLATION:      'ERR_DUPLICATE_RECORD',
  DB_RECORD_NOT_FOUND:      'ERR_RECORD_NOT_FOUND',
  DB_FOREIGN_KEY_VIOLATION: 'ERR_REFERENTIAL_INTEGRITY',
  DB_CONNECTION:            'ERR_DB_UNAVAILABLE',
  UNKNOWN:                  'ERR_UNKNOWN',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// ─────────────────────────────────────────────────────────────────────────────
// Structured log entry shape (written to stdout for log aggregators)
// ─────────────────────────────────────────────────────────────────────────────
export interface StructuredErrorLog {
  level: 'error' | 'warn';
  timestamp: string;
  traceId: string;
  method: string;
  /** URL path — PII query-string values are stripped before logging */
  path: string;
  statusCode: number;
  errorCode: ErrorCode;
  /** Internal detail — logged only, never forwarded to clients */
  internalMessage: string;
  stack?: string;
  prismaCode?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Client-safe response shape
// ─────────────────────────────────────────────────────────────────────────────
export interface ErrorResponse {
  statusCode: number;
  /** i18n key for front-end localisation */
  errorCode: ErrorCode;
  /** Short English fallback — safe, contains no PII */
  message: string;
  timestamp: string;
  path: string;
  /** Correlates this response with the server log entry */
  traceId: string;
  /** Passed through when the original exception carries these fields */
  requiresStepUp?: boolean;
  stepUpToken?: string;
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Query-string parameters that may contain PII — redacted from logs. */
const SENSITIVE_PARAMS = ['email', 'token', 'password', 'phone', 'telegramId', 'code'];

@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly recurrenceTracker: ErrorRecurrenceTrackerService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Main catch handler
  // ──────────────────────────────────────────────────────────────────────────

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx     = host.switchToHttp();
    const req     = ctx.getRequest<Request>();
    const traceId = this.generateTraceId();
    const safePath = this.redactSensitiveParams(req.url);

    // ── Classify the exception ─────────────────────────────────────────────
    const { statusCode, errorCode, internalMessage, prismaCode } =
      this.classify(exception);

    // ── Structured internal log ────────────────────────────────────────────
    const logEntry: StructuredErrorLog = {
      level:           statusCode >= 500 ? 'error' : 'warn',
      timestamp:       new Date().toISOString(),
      traceId,
      method:          req.method,
      path:            safePath,
      statusCode,
      errorCode,
      internalMessage,
      prismaCode,
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    if (logEntry.level === 'error') {
      this.logger.error(JSON.stringify(logEntry));
    } else {
      this.logger.warn(JSON.stringify(logEntry));
    }

    // ── Notify recurrence tracker (fire-and-forget) ────────────────────────
    this.recurrenceTracker.track(errorCode, safePath, internalMessage);

    // ── Client response (GDPR-safe) ────────────────────────────────────────
    const body: ErrorResponse = {
      statusCode,
      errorCode,
      message: this.buildClientMessage(statusCode, errorCode, exception),
      timestamp: new Date().toISOString(),
      path: safePath,
      traceId,
      // Pass through step-up fields so the frontend can open the modal
      ...(exception instanceof HttpException
        ? (() => {
            const resp = exception.getResponse();
            if (typeof resp === 'object' && resp !== null) {
              const r = resp as Record<string, unknown>;
              return {
                ...(r.requiresStepUp === true ? { requiresStepUp: true as const } : {}),
                ...(typeof r.stepUpToken === 'string' ? { stepUpToken: r.stepUpToken } : {}),
              };
            }
            return {};
          })()
        : {}),
    };

    httpAdapter.reply(ctx.getResponse(), body, statusCode);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: exception classification
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Map the raw exception to a status code, i18n error code, and internal
   * message.  Order matters: most specific first.
   */
  private classify(exception: unknown): {
    statusCode: number;
    errorCode: ErrorCode;
    internalMessage: string;
    prismaCode?: string;
  } {
    // 1. NestJS HttpException hierarchy (includes ValidationPipe errors)
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response   = exception.getResponse();
      const internalMessage =
        typeof response === 'string'
          ? response
          : (response as { message?: string | string[] }).message?.toString()
            ?? exception.message;

      return {
        statusCode,
        errorCode: this.httpStatusToCode(statusCode),
        internalMessage,
      };
    }

    // 2. Prisma known request errors (P1xxx / P2xxx)
    if (isPrismaError(exception)) {
      return this.classifyPrismaError(exception);
    }

    // 3. Standard JS / TS Error
    if (exception instanceof Error) {
      return {
        statusCode:      HttpStatus.INTERNAL_SERVER_ERROR,
        errorCode:       ERROR_CODES.INTERNAL_SERVER_ERROR,
        internalMessage: exception.message,
      };
    }

    // 4. Non-Error throw (string, number, object…)
    return {
      statusCode:      HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode:       ERROR_CODES.UNKNOWN,
      internalMessage: String(exception),
    };
  }

  /** Translate Prisma error codes to HTTP status + i18n code. */
  private classifyPrismaError(err: PrismaKnownError): {
    statusCode: number;
    errorCode: ErrorCode;
    internalMessage: string;
    prismaCode: string;
  } {
    switch (err.code) {
      case 'P2002': // Unique constraint
        return { statusCode: HttpStatus.CONFLICT,
                 errorCode: ERROR_CODES.DB_UNIQUE_VIOLATION,
                 internalMessage: err.message, prismaCode: err.code };
      case 'P2025': // Record not found
        return { statusCode: HttpStatus.NOT_FOUND,
                 errorCode: ERROR_CODES.DB_RECORD_NOT_FOUND,
                 internalMessage: err.message, prismaCode: err.code };
      case 'P2003': // Foreign key constraint
        return { statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
                 errorCode: ERROR_CODES.DB_FOREIGN_KEY_VIOLATION,
                 internalMessage: err.message, prismaCode: err.code };
      case 'P1001': // Cannot reach DB server
      case 'P1002': // DB timed out
        return { statusCode: HttpStatus.SERVICE_UNAVAILABLE,
                 errorCode: ERROR_CODES.DB_CONNECTION,
                 internalMessage: err.message, prismaCode: err.code };
      default:
        return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                 errorCode: ERROR_CODES.INTERNAL_SERVER_ERROR,
                 internalMessage: err.message, prismaCode: err.code };
    }
  }

  /** Map HTTP status integer to an i18n error code. */
  private httpStatusToCode(status: number): ErrorCode {
    const map: Record<number, ErrorCode> = {
      [HttpStatus.BAD_REQUEST]:           ERROR_CODES.BAD_REQUEST,
      [HttpStatus.UNAUTHORIZED]:          ERROR_CODES.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]:             ERROR_CODES.FORBIDDEN,
      [HttpStatus.NOT_FOUND]:             ERROR_CODES.NOT_FOUND,
      [HttpStatus.CONFLICT]:              ERROR_CODES.CONFLICT,
      [HttpStatus.UNPROCESSABLE_ENTITY]:  ERROR_CODES.UNPROCESSABLE,
      [HttpStatus.TOO_MANY_REQUESTS]:     ERROR_CODES.TOO_MANY_REQUESTS,
      [HttpStatus.INTERNAL_SERVER_ERROR]: ERROR_CODES.INTERNAL_SERVER_ERROR,
    };
    return map[status] ?? ERROR_CODES.INTERNAL_SERVER_ERROR;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: GDPR-safe client message
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Build a message safe to include in the HTTP response:
   *  • 4xx: operational — the message IS intended for the user.
   *  • 5xx production: generic text, no internal details exposed.
   *  • 5xx development: actual error message for debuggability.
   */
  private buildClientMessage(
    statusCode: number,
    _errorCode: ErrorCode,
    exception: unknown,
  ): string {
    if (statusCode < 500) {
      if (exception instanceof HttpException) {
        const resp = exception.getResponse();
        if (typeof resp === 'string') return resp;
        const msg = (resp as { message?: string | string[] }).message;
        if (Array.isArray(msg)) return msg.join('; ');
        return msg ?? 'Request error.';
      }
      if (isPrismaError(exception)) {
        if (exception.code === 'P2002') return 'A record with this value already exists.';
        if (exception.code === 'P2025') return 'The requested resource was not found.';
        if (exception.code === 'P2003') return 'Referential integrity constraint violated.';
      }
    }

    // 5xx — never reveal internals in production (GDPR / security)
    if (IS_PRODUCTION) {
      return 'An unexpected error occurred. Please try again later.';
    }

    // Development convenience
    if (exception instanceof Error) return exception.message;
    if (isPrismaError(exception))   return `Database error (${exception.code}).`;
    return 'An unexpected error occurred.';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private: GDPR helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Strip values of known-sensitive query-string parameters from a URL so
   * they are never written to log files.
   * e.g. /auth/verify?token=secret&email=user@x.com → /auth/verify?token=[R]&email=[R]
   */
  private redactSensitiveParams(url: string): string {
    try {
      const [path, query] = url.split('?');
      if (!query) return url;

      const redacted = query
        .split('&')
        .map((pair) => {
          const [key] = pair.split('=');
          return SENSITIVE_PARAMS.includes(key.toLowerCase())
            ? `${key}=[REDACTED]`
            : pair;
        })
        .join('&');

      return `${path}?${redacted}`;
    } catch {
      return url;
    }
  }

  /** Produce a short, unique trace ID without external dependencies. */
  private generateTraceId(): string {
    return (
      Date.now().toString(36) +
      Math.random().toString(36).substring(2, 8)
    ).toUpperCase();
  }
}
