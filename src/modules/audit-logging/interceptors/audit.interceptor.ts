import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuditLoggingService } from '../audit-logging.service';
import { redactAuditPayload } from '../utils/gdpr-redactor.util';

/** Paths that must never generate HTTP audit noise or recursion. */
const SKIP_PATH_FRAGMENTS = [
  '/health',
  '/api/v1/health',
  '/admin/audit-logs',
  '/docs',
  '/swagger',
  '/api-json',
];

interface AuthenticatedRequest extends Request {
  user?: {
    userId?: string;
    id?: string;
    email?: string;
    role?: string;
  };
}

/**
 * Persists a GDPR-safe HTTP audit trail after each request completes.
 * Failures are swallowed so auditing never breaks the primary response.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLoggingService: AuditLoggingService) {}

  /**
   * Intercepts HTTP calls and writes an `HTTP_REQUEST` audit event.
   *
   * @param context - Nest execution context
   * @param next - Downstream handler
   * @returns Observable of the handler result
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<AuthenticatedRequest>();
    const res = http.getResponse<Response>();
    const path = this.resolvePath(req);

    if (this.shouldSkip(path)) {
      return next.handle();
    }

    const startedAt = Date.now();
    const method = (req.method || 'GET').toUpperCase();

    return next.handle().pipe(
      tap({
        next: () => {
          void this.persist(req, res, method, path, startedAt);
        },
        error: (error: { status?: number; statusCode?: number }) => {
          const statusCode = error?.status ?? error?.statusCode ?? res.statusCode ?? 500;
          void this.persist(req, res, method, path, startedAt, statusCode);
        },
      }),
    );
  }

  /**
   * Returns true when the path should not be audited.
   *
   * @param path - Request path
   * @returns Whether auditing is skipped
   */
  shouldSkip(path: string): boolean {
    const normalized = path.toLowerCase();
    return SKIP_PATH_FRAGMENTS.some((fragment) => normalized.includes(fragment));
  }

  /**
   * Builds and persists the HTTP audit row.
   *
   * @param req - Express request
   * @param res - Express response
   * @param method - HTTP method
   * @param path - Request path
   * @param startedAt - High-resolution start timestamp
   * @param statusOverride - Optional status when the handler threw
   */
  private async persist(
    req: AuthenticatedRequest,
    res: Response,
    method: string,
    path: string,
    startedAt: number,
    statusOverride?: number,
  ): Promise<void> {
    const actorUserId = req.user?.userId || req.user?.id;
    const statusCode = statusOverride ?? res.statusCode ?? 200;
    const durationMs = Date.now() - startedAt;
    const ipAddress = this.resolveIp(req);

    const bodyPreview =
      req.body && typeof req.body === 'object'
        ? redactAuditPayload(req.body as Record<string, unknown>)
        : undefined;

    await this.auditLoggingService.createSafe({
      eventType: 'HTTP_REQUEST',
      entityId: actorUserId || 'anonymous',
      entityType: 'HttpRequest',
      processedBy: AuditInterceptor.name,
      actorUserId,
      ipAddress,
      httpMethod: method,
      path,
      statusCode,
      durationMs,
      payload: {
        query: redactAuditPayload((req.query || {}) as Record<string, unknown>),
        ...(bodyPreview && Object.keys(bodyPreview).length > 0 ? { body: bodyPreview } : {}),
        role: req.user?.role,
      },
    });
  }

  /**
   * Resolves a stable path string from the request.
   *
   * @param req - Express request
   * @returns Path without query string when possible
   */
  private resolvePath(req: AuthenticatedRequest): string {
    const raw = req.originalUrl || req.url || req.path || '/';
    return raw.split('?')[0] || '/';
  }

  /**
   * Resolves client IP from proxy headers or the socket address.
   *
   * @param req - Express request
   * @returns Best-effort IP string
   */
  private resolveIp(req: AuthenticatedRequest): string | undefined {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0]?.trim();
    }
    if (Array.isArray(forwarded) && forwarded[0]) {
      return forwarded[0].split(',')[0]?.trim();
    }
    return req.ip || req.socket?.remoteAddress || undefined;
  }
}
