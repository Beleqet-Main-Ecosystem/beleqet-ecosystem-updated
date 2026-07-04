import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createKeyvNonBlocking } from '@keyv/redis';
import { RedisCacheService } from './redis-cache.service';
import { JOBS_CACHE_NAMESPACE } from './cache.constants';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('REDIS_HOST', 'localhost');
        const port = Number(config.get<string | number>('REDIS_PORT', 6379)) || 6379;
        const password = config.get<string>('REDIS_PASSWORD');
        const protocol = config.get<string>('REDIS_TLS') === 'true' ? 'rediss' : 'redis';
        const credentials = password ? `:${encodeURIComponent(password)}@` : '';
        const redisUrl = `${protocol}://${credentials}${host}:${port}`;
        const ttl = Number(config.get<string | number>('CACHE_DEFAULT_TTL_MS', 60_000)) || 60_000;

        return {
          stores: [
            createKeyvNonBlocking(redisUrl, {
              namespace: JOBS_CACHE_NAMESPACE,
              throwOnConnectError: false,
              throwOnErrors: true,
              connectionTimeout: 1_000,
            }),
          ],
          ttl,
        };
      },
    }),
  ],
  providers: [RedisCacheService],
  exports: [RedisCacheService],
})
export class RedisCacheModule {}

