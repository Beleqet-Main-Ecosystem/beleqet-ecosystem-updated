import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AiFeedService } from './ai-feed.service';
import { GetFeedDto } from './dto/get-feed.dto';

@Controller('api/v1/ai-feed')
export class AiFeedController {
  constructor(private readonly aiFeedService: AiFeedService) {}

  @Get()
  async getFeed(@Query() query: GetFeedDto, @Req() req: any) {
    // TODO: Replace with real JWT user extraction (e.g., req.user.id)
    // For now, use a hardcoded valid user ID from your seed data (e.g., find one in your DB)
    // You can change this to a real ID when testing on PC.
    const userId = req.user?.id || 'mock-user-id'; 
    return this.aiFeedService.getPersonalizedFeed(userId, query.limit);
  }
    }
