import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AUDIT_LOGGER } from '../../common/interfaces/audit-logger.interface';

/**
 * Cross-cutting audit trail module. Exports `AuditService` (for direct
 * calls like `logPaymentTransaction`) and `AuditInterceptor` (for
 * declarative `@AuditLog()` logging on any controller method).
 */
@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditInterceptor,
    { provide: AUDIT_LOGGER, useExisting: AuditService },
  ],
  exports: [AuditService, AuditInterceptor, AUDIT_LOGGER],
})
export class AuditModule {}
