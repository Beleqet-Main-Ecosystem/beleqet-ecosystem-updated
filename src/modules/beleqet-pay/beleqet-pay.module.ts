import { Module } from '@nestjs/common';
import { BeleqetPayService } from './beleqet-pay.service';

@Module({
  providers: [BeleqetPayService],
  exports: [BeleqetPayService],
})
export class BeleqetPayModule {}
