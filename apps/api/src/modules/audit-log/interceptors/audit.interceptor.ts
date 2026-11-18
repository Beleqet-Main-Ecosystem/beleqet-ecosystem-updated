import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditLogService } from '../audit-log.service';
import { AUDIT_ACTION_KEY, AuditActionOptions } from '../decorators/audit-log.decorator';

/**
 * Global or controller-level NestJS Interceptor that automatically captures incoming requests
 * and outgoing responses to persist audited user activities.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { id?: string; sub?: string } }>();
    const { method, url, body, headers } = request;

    // Check for custom @AuditAction decorator metadata
    const auditMetadata = this.reflector.getAllAndOverride<AuditActionOptions | undefined>(
      AUDIT_ACTION_KEY,
      [context.getHandler(), context.getClass()],
    );

    const action = auditMetadata ? auditMetadata.action : `${method} ${url.split('?')[0]}`;
    const entity = auditMetadata
      ? auditMetadata.entity
      : (url.split('/')[3] || 'System').toUpperCase();

    const userId = request.user?.id || request.user?.sub || null;
    const ipAddress = (headers['x-forwarded-for'] as string) || request.ip || '127.0.0.1';
    const userAgent = headers['user-agent'] || 'Unknown';

    // Extract entityId if present in route params
    const entityId = request.params?.id || undefined;

    return next.handle().pipe(
      tap({
        next: (responseData: unknown) => {
          // Asynchronously record audit log without blocking HTTP response
          this.auditLogService
            .createLog({
              userId: userId || undefined,
              action,
              entity,
              entityId,
              previousState:
                body && typeof body === 'object' ? (body as Record<string, unknown>) : undefined,
              newState:
                responseData && typeof responseData === 'object'
                  ? (responseData as Record<string, unknown>)
                  : undefined,
              ipAddress,
              userAgent,
            })
            .catch((err) => {
              this.logger.error(`AuditInterceptor error logging action ${action}: ${err.message}`);
            });
        },
      }),
    );
  }
}
