import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { WalletModule } from '../wallet/wallet.module';
import { AuditLoggingController } from './audit-logging.controller';
import { AuditLoggingService } from './audit-logging.service';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { AUDIT_LOGGING_SERVICE } from './interfaces/audit-log.interface';

/**
 * Automated Testing & Audit Logging module.
 * Provides HTTP request auditing, admin log query APIs, and GDPR-safe persistence.
 */
@Module({
  imports: [WalletModule],
  controllers: [AuditLoggingController],
  providers: [
    AuditLoggingService,
    {
      provide: AUDIT_LOGGING_SERVICE,
      useExisting: AuditLoggingService,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [AuditLoggingService, AUDIT_LOGGING_SERVICE],
})
export class AuditLoggingModule {}
