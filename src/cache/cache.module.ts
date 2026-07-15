import { Module, Global } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          // Use DB 1 to avoid interfering with BullMQ (which uses DB 0)
          url: configService.get<string>('redis.url') + '/1',
          ttl: (configService.get<number>('redis.ttlSeconds') ?? 60) * 1000,
          socket: { connectTimeout: 5000 },
        }),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheConfigModule {}