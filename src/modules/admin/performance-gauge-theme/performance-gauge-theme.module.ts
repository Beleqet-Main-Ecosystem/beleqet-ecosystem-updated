import { Module } from '@nestjs/common';
import { PerformanceGaugeThemeController } from './performance-gauge-theme.controller';
import { PerformanceGaugeThemeRepository } from './performance-gauge-theme.repository';
import { PerformanceGaugeThemeService } from './performance-gauge-theme.service';

/** Wires the isolated Performance Gauge theme feature into Nest dependency injection. */
@Module({
  controllers: [PerformanceGaugeThemeController],
  providers: [PerformanceGaugeThemeRepository, PerformanceGaugeThemeService],
  exports: [PerformanceGaugeThemeService],
})
export class PerformanceGaugeThemeModule {}
