import { Module } from '@nestjs/common';
import { FreelanceService } from './freelance.service';
import { FreelanceController } from './freelance.controller';
import { EscrowModule } from '../escrow/escrow.module';

@Module({
  imports: [EscrowModule],
  providers: [FreelanceService],
  controllers: [FreelanceController],
  exports: [FreelanceService],
})
export class FreelanceModule {}
