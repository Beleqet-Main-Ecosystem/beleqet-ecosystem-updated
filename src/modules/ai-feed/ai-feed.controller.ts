import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AiFeedService, PersonalizedJob } from './ai-feed.service';
import { GetFeedDto } from './dto/get-feed.dto';

/**
 * Exposes the "AI Personal Feed" REST endpoint.
 *
 * Route is mounted at `/api/v1/ai-feed` (the `api/v1` segment comes from the
 * global prefix set in `main.ts` — it must NOT be repeated in `@Controller()`).
 *
 * Every request must carry a valid JWT: personalization is always computed
 * for the authenticated caller (`@CurrentUser()`), never for a client-supplied
 * user id, so one user can never read another user's recommendations.
 */
@ApiTags('ai-feed')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-feed')
export class AiFeedController {
  constructor(private readonly aiFeedService: AiFeedService) {}

  /**
   * Returns a ranked list of jobs personalized for the current user.
   *
   * The list is recomputed on every call directly from the latest
   * `SearchHistory`, `skills`, and `SavedJob` data, so it is always
   * up to date with the user's most recent activity (this satisfies the
   * "feed must keep updating as new data arrives" requirement without
   * needing a separate cron job or stale cache).
   *
   * @param query - validated `limit` query parameter
   * @param user - the authenticated caller, injected by `JwtAuthGuard`
   * @returns up to `limit` jobs, each annotated with a `relevanceScore` (0-100)
   */
  @Get()
  async getFeed(
    @Query() query: GetFeedDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<PersonalizedJob[]> {
    return this.aiFeedService.getPersonalizedFeed(user.userId, query.limit);
  }
}