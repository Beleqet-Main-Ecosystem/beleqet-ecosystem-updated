import { Module } from '@nestjs/common';
import { ChapaClient } from './chapa.client';

@Module({
  providers: [ChapaClient],
  exports: [ChapaClient],
})
export class ChapaModule {}
