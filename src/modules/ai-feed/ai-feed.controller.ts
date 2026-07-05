import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AiFeedService } from './ai-feed.service';
import { GetFeedDto } from './dto/get-feed.dto';

@UseGuards(JwtAuthGuard)
@Controller('ai-feed')
export class AiFeedController {
  constructor(private readonly aiFeedService: AiFeedService) {}

  @Get()
  async getFeed(
    @Query() query: GetFeedDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.aiFeedService.getPersonalizedFeed(user.userId, query.limit);
  }
}
