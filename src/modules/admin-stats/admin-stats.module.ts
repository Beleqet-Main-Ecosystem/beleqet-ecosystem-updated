import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { AdminStatsController } from './admin-stats.controller';
import { AdminStatsRepository } from './admin-stats.repository';
import { AdminStatsService } from './admin-stats.service';
import { ADMIN_STATS_CURRENCY_CONVERTER, CurrencyConverter } from './currency-converter.port';
import { WalletService } from '../wallet/wallet.service';

/**
 * Admin Stats feature module — isolated request / logic / data layers.
 */
@Module({
  imports: [WalletModule],
  controllers: [AdminStatsController],
  providers: [
    AdminStatsRepository,
    AdminStatsService,
    {
      provide: ADMIN_STATS_CURRENCY_CONVERTER,
      inject: [WalletService],
      useFactory: (walletService: WalletService): CurrencyConverter => walletService,
    },
  ],
  exports: [AdminStatsService],
})
export class AdminStatsModule {}
