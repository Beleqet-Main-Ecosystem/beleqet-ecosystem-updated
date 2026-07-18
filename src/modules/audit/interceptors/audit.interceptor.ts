import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
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
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
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
        void this.auditService.log(eventType, actorId, {
          method: req.method,
          path: req.originalUrl,
        });
      }),
    );
  }
}
