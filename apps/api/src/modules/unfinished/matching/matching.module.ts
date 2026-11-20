import { Module } from '@nestjs/common';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';

// PrismaModule is @Global() in this repo (see src/prisma/prisma.module.ts),
// so PrismaService is injectable here without importing it explicitly —
// matches the pattern used by smart-bidding.module.ts and freelance.module.ts.
@Module({
  controllers: [MatchingController],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
