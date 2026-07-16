import { Module } from '@nestjs/common';
import { AiFeedController } from './ai-feed.controller';
import { AiFeedService } from './ai-feed.service';

/**
 * Wires the AI Personal Feed feature together via Nest's dependency
 * injection, per the project's modular-architecture requirement.
 *
 * `PrismaService` is intentionally NOT listed in `providers` here: it is
 * provided once, globally, by `PrismaModule` (see `src/prisma/prisma.module.ts`,
 * marked `@Global()`). Re-declaring it here would create a second,
 * disconnected `PrismaService` instance instead of reusing the shared one.
 */
@Module({
  controllers: [AiFeedController],
  providers: [AiFeedService],
  exports: [AiFeedService],
})
export class AiFeedModule {}