import { Module } from '@nestjs/common';
import { InMemoryReviewRepository } from './repositories/in-memory-review.repository';
import { REVIEW_REPOSITORY } from './interfaces/review-repository.interface';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

/**
 * Self-contained feature module for the Review System.
 *
 * The concrete repository is bound to the `REVIEW_REPOSITORY` token
 * here, and only here — swapping `InMemoryReviewRepository` for a
 * TypeORM/Prisma implementation is a one-line change that requires no
 * modification to {@link ReviewService} or {@link ReviewController}.
 */
@Module({
  controllers: [ReviewController],
  providers: [
    ReviewService,
    {
      provide: REVIEW_REPOSITORY,
      useClass: InMemoryReviewRepository,
    },
  ],
  exports: [ReviewService],
})
export class ReviewModule {}
