import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { AuditInterceptor } from './interceptors/audit.interceptor';

/**
 * NestJS Module encapsulating Automated Audit Logging services, interceptors, and RESTful controllers.
 */
@Module({
  imports: [PrismaModule],
  controllers: [AuditLogController],
  providers: [AuditLogService, AuditInterceptor],
  exports: [AuditLogService, AuditInterceptor],
})
export class AuditLogModule {}
