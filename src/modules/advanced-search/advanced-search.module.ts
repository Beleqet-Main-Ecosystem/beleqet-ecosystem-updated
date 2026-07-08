/**
 * Advanced Search Module
 *
 * NestJS module for the advanced search functionality.
 * Follows the existing module pattern in the codebase.
 */

import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdvancedSearchController } from './advanced-search.controller';
import { AdvancedSearchService } from './advanced-search.service';
import { SearchRepository } from './advanced-search.repository';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule,
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        ttl: config.get('SEARCH_CACHE_TTL', 300) * 1000, // Convert to milliseconds
        max: 100, // Maximum number of items in cache
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdvancedSearchController],
  providers: [SearchRepository, AdvancedSearchService],
  exports: [AdvancedSearchService, SearchRepository],
})
export class AdvancedSearchModule {}
