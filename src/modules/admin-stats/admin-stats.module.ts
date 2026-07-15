import { Module } from '@nestjs/common';
import { AdminStatsService } from './admin-stats.service';
import { AdminStatsController } from './admin-stats.controller';
import { WalletModule } from '../wallet/wallet.module';

/**
 * Module encapsulating the Admin Statistics features.
 */
@Module({
  imports: [WalletModule],
  controllers: [AdminStatsController],
  providers: [AdminStatsService],
  exports: [AdminStatsService],
})
export class AdminStatsModule {}
