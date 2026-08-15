import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { REVIEW_REPOSITORY } from './interfaces/review-repository.interface';
import { PrismaReviewRepository } from './repositories/prisma-review.repository';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReviewController],
  providers: [
    ReviewService,
    {
      provide: REVIEW_REPOSITORY,
      useClass: PrismaReviewRepository,
    },
  ],
  exports: [ReviewService],
})
export class ReviewModule {}
