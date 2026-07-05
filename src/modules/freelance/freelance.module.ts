import { Module } from '@nestjs/common';
import { FreelanceService } from './freelance.service';
import { FreelanceController } from './freelance.controller';
import { EscrowModule } from '../escrow/escrow.module';
import { AuditTrailModule } from '../audit-trail/audit-trail.module';

@Module({
  imports: [EscrowModule, AuditTrailModule],
  providers: [FreelanceService],
  controllers: [FreelanceController],
  exports: [FreelanceService],
})
export class FreelanceModule {}
