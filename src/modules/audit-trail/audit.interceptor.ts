import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuid } from 'uuid';
import { AuditService } from './audit.service';
import { AUDIT_METADATA_KEY, AuditMetadata } from './audit.decorator';

/**
 * Global interceptor that writes audit log entries for controller methods
 * annotated with `@Audit()`.
 *
 * After the handler resolves, extracts actor context, IP, User-Agent,
 * correlation ID, and entity ID from the request, then calls
 * `AuditService.log()` asynchronously (fire-and-forget).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.get<AuditMetadata>(AUDIT_METADATA_KEY, context.getHandler());

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const ipAddress =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? request.ip;
    const userAgent = request.headers['user-agent'];
    const correlationId = (request.headers['x-correlation-id'] as string) ?? uuid();

    let entityId: string | undefined;
    if (metadata.entityIdPath) {
      const parts = metadata.entityIdPath.split('.');
      let val: unknown = request;
      for (const part of parts) {
        val = (val as Record<string, unknown>)?.[part];
      }
      entityId = typeof val === 'string' ? val : undefined;
    } else {
      entityId = request.params?.id;
    }

    return next.handle().pipe(
      tap(() => {
        this.auditService
          .log({
            actorId: user?.id,
            actorEmail: user?.email,
            actorRole: user?.role,
            action: metadata.action,
            entityType: metadata.entityType,
            entityId,
            ipAddress,
            userAgent,
            correlationId,
          })
          .catch(() => {});
      }),
    );
  }
}
