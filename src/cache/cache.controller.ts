import { Controller, Get, Delete, Param, Body, Post } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheRequestDto } from './dto/cache-request.dto';

@Controller('cache')
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  @Get(':key')
  async get(@Param() params: CacheRequestDto) {
    return this.cacheService.get(params.key, params.namespace);
  }

  @Post(':key')
  async set(
    @Param() params: CacheRequestDto,
    @Body() body: { value: unknown; ttl?: number },
  ) {
    await this.cacheService.set(params.key, body.value, {
      ttl: body.ttl || params.ttl,
      namespace: params.namespace,
    });
    return { success: true };
  }

  @Delete(':key')
  async del(@Param() params: CacheRequestDto) {
    await this.cacheService.del(params.key, params.namespace);
    return { success: true };
  }
}