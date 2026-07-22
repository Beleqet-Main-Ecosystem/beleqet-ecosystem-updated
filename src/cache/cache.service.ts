import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { CacheOptions } from './interfaces/cache-options.interface';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly prefix: string;
  private readonly piiSalt: string;
  private readonly debug: boolean;
  private readonly pendingFetches = new Map<string, Promise<any>>();

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {
    this.prefix = this.configService.get<string>('redis.prefix') || 'beleqet:';
    this.piiSalt = this.configService.get<string>('security.piiSalt') || 'default-salt';
    this.debug = this.configService.get<boolean>('redis.debug') || false;
  }

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    if (options?.skipCache) {
      return fetchFn();
    }

    const fullKey = this.buildKey(key, options?.namespace);
    const ttlMs = options?.ttl ? options.ttl * 1000 : undefined;

    if (this.pendingFetches.has(fullKey)) {
      return this.pendingFetches.get(fullKey) as Promise<T>;
    }

    const fetchPromise = (async () => {
      try {
        const cached = await this.cacheManager.get<T>(fullKey);
        if (cached !== undefined) {
          return cached;
        }

        let data: T;
        try {
          data = await fetchFn();
        } catch (fetchError: unknown) {
          throw fetchError;
        }

        await this.cacheManager.set(fullKey, data, ttlMs);
        return data;
      } finally {
        this.pendingFetches.delete(fullKey);
      }
    })();

    this.pendingFetches.set(fullKey, fetchPromise);

    try {
      return await fetchPromise;
    } catch (error: unknown) {
      this.pendingFetches.delete(fullKey);
      return fetchFn();
    }
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.buildKey(key, options?.namespace);
    const ttlMs = options?.ttl ? options.ttl * 1000 : undefined;
    await this.cacheManager.set(fullKey, value, ttlMs);
  }

  async get<T>(key: string, namespace?: string): Promise<T | undefined> {
    const fullKey = this.buildKey(key, namespace);
    return this.cacheManager.get<T>(fullKey);
  }

  async del(key: string, namespace?: string): Promise<void> {
    const fullKey = this.buildKey(key, namespace);
    await this.cacheManager.del(fullKey);
  }

  buildKey(key: string, namespace?: string, hashPii = false): string {
    let finalKey = key;
    if (hashPii) {
      finalKey = this.hashPii(key);
    }
    if (namespace) {
      return `${this.prefix}${namespace}:${finalKey}`;
    }
    return `${this.prefix}${finalKey}`;
  }

  hashPii(value: string): string {
    return createHash('sha256')
      .update(value + this.piiSalt)
      .digest('hex')
      .substring(0, 32);
  }
}
