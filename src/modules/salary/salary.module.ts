import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SalaryController } from './salary.controller';
import { SalaryService } from './salary.service';
import { SalaryProcessor } from './salary.processor';
import { CurrencyService } from './currency/currency.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * SalaryModule - AI Salary Helper Module
 *
 * Provides comprehensive salary prediction and market analysis features:
 * - AI-powered salary prediction based on multiple factors
 * - Market statistics and trend analysis
 * - Historical salary data with GDPR compliance
 * - Background job processing for analytics
 *
 * Uses NestJS modular architecture with:
 * - Service layer for business logic
 * - Controller layer for REST API
 * - Processor for background jobs
 * - Dependency Injection for loose coupling
 */
@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'salary',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  controllers: [SalaryController],
  providers: [SalaryService, SalaryProcessor, CurrencyService],
  exports: [SalaryService],
})
export class SalaryModule {}
