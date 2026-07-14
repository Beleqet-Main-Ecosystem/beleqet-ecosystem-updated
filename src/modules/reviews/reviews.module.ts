/**
 * @file reviews.module.ts
 * @description
 * NestJS module for the Review System.
 * Wires together the ReviewsService and ReviewsController,
 * and imports PrismaModule for database access.
 *
 * Exports ReviewsService for use in other modules if needed.
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
