import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditService } from '../audit.service';
import { AUDIT_LOG_KEY } from '../decorators/audit-log.decorator';

interface AuthedRequest extends Request {
  user?: { userId: string; role: string };
}

/**
 * Automatically writes an audit trail entry for any handler decorated
 * with `@AuditLog(eventType)`, after the handler completes successfully.
 * Skips logging entirely if the handler throws — failed requests are
 * the responsibility of error-tracking, not the audit trail.
 *
 * The audit write itself is fire-and-forget with an explicit `.catch()`:
 * a database hiccup while writing the audit entry must never crash the
 * server or fail the user's actual request. Failures are logged via
 * NestJS's Logger instead of being swallowed silently.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const eventType = this.reflector.get<string>(AUDIT_LOG_KEY, context.getHandler());
    if (!eventType) return next.handle();

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const actorId = req.user?.userId ?? 'anonymous';

    return next.handle().pipe(
      tap(() => {
        this.auditService
          .log(eventType, actorId, { method: req.method, path: req.originalUrl })
          .catch((err: unknown) => {
            this.logger.error(
              `Failed to write audit log for event "${eventType}" (actor: ${actorId})`,
              err instanceof Error ? err.stack : String(err),
            );
          });
      }),
    );
  }
}
