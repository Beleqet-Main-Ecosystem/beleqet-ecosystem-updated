import { Global, Module } from '@nestjs/common';
import { AUDIT_LOGGER } from '../../common/interfaces/audit-logger.interface';
import { WalletModule } from '../wallet/wallet.module';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

/**
 * The audit trail (`events_log`): business events (sign-ins, account links, role changes, admin
 * actions, payments) written through AuditService, and the admin's audit log viewer
 * (/admin/audit-logs). Global, like a logger: any module can inject AuditService or AUDIT_LOGGER.
 * Web requests are not recorded here; nginx keeps those.
 */
@Global()
@Module({
  imports: [WalletModule],
  controllers: [AuditController],
  providers: [AuditService, { provide: AUDIT_LOGGER, useExisting: AuditService }],
  exports: [AuditService, AUDIT_LOGGER],
})
export class AuditModule {}
