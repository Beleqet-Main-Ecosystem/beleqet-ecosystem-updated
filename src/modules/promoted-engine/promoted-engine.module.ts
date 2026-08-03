import { Module } from '@nestjs/common';
import { PromotedEngineController } from './promoted-engine.controller';
import { PromotedEngineService } from './promoted-engine.service';

// PrismaModule is @Global() in this repo, so PrismaService is injectable
// here without importing it explicitly — matches matching.module.ts.
@Module({
  controllers: [PromotedEngineController],
  providers: [PromotedEngineService],
  exports: [PromotedEngineService],
})
export class PromotedEngineModule {}