import { Module } from '@nestjs/common';
import { TaxCalculatorController } from './tax-calculator.controller';
import { TaxCalculatorService } from './tax-calculator.service';

@Module({
  controllers: [TaxCalculatorController],
  providers: [TaxCalculatorService],
  exports: [TaxCalculatorService],
})
export class TaxCalculatorModule {}
