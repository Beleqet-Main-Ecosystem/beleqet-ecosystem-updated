import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AiFeedService } from './ai-feed.service';
import { GetFeedDto } from './dto/get-feed.dto';

@UseGuards(JwtAuthGuard)
@Controller('ai-feed')
export class AiFeedController {
  constructor(private readonly aiFeedService: AiFeedService) {}

  /**
   * Retrieves the personalized job feed for the authenticated user.
   * 
   * If GDPR consent is false, returns a generic (non-personalized) list of published jobs.
   * If consent is true, analyzes the user's search history (last 30 days) to extract keywords,
   * scores all published jobs based on keyword matches, and returns the top results.
   *
   * @param query - DTO containing the `limit` parameter (default: 5, min: 1, max: 20).
   * @param user - The authenticated user's payload extracted from the JWT token.
   * @returns An array of jobs with a `relevanceScore` property (if GDPR consent is true).
   */
  @Get()
  async getFeed(
    @Query() query: GetFeedDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.aiFeedService.getPersonalizedFeed(user.userId, query.limit);
  }
}
