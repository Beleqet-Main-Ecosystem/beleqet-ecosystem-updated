import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsRepository } from './admin-stats.repository';
import { AdminStatsService } from './admin-stats.service';

/**
 * Admin Stats feature module — isolated request / logic / data layers.
 */
@Module({
  imports: [WalletModule],
  controllers: [AdminStatsController],
  providers: [AdminStatsRepository, AdminStatsService],
  exports: [AdminStatsService],
})
export class AdminStatsModule {}
