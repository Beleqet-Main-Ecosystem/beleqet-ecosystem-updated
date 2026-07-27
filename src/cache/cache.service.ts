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

  /**
   * Get a value from cache, or fetch it with the provided function.
   * Implements coalescing (request collapsing) to prevent duplicate concurrent fetches.
   * On error, the pending entry is cleared so subsequent calls can retry.
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    if (options?.skipCache) {
      return fetchFn();
    }

    const fullKey = this.buildKey(key, options?.namespace);
    const ttlSeconds = options?.ttl; // in seconds

    if (this.pendingFetches.has(fullKey)) {
      if (this.debug) {
        this.logger.debug(`Coalescing fetch for key: ${fullKey}`);
      }
      return this.pendingFetches.get(fullKey) as Promise<T>;
    }

    // ✅ Declare variable outside the async function
    let fetchPromise: Promise<T>;

    fetchPromise = (async () => {
      try {
        const cached = await this.cacheManager.get<T>(fullKey);
        if (cached !== undefined) {
          if (this.debug) {
            this.logger.debug(`Cache hit for key: ${fullKey}`);
          }
          return cached;
        }

        if (this.debug) {
          this.logger.debug(`Cache miss for key: ${fullKey}, fetching fresh data`);
        }

        const data = await fetchFn();
        await this.cacheManager.set(fullKey, data, ttlSeconds);
        return data;
      } finally {
        // ✅ Now fetchPromise is defined
        if (this.pendingFetches.get(fullKey) === fetchPromise) {
          this.pendingFetches.delete(fullKey);
        }
      }
    })();

    this.pendingFetches.set(fullKey, fetchPromise);
    return fetchPromise;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.buildKey(key, options?.namespace);
    const ttlSeconds = options?.ttl;
    await this.cacheManager.set(fullKey, value, ttlSeconds);
    if (this.debug) {
      this.logger.debug(`Set cache for key: ${fullKey} with TTL ${ttlSeconds}s`);
    }
  }

  async get<T>(key: string, namespace?: string): Promise<T | undefined> {
    const fullKey = this.buildKey(key, namespace);
    return this.cacheManager.get<T>(fullKey);
  }

  async del(key: string, namespace?: string): Promise<void> {
    const fullKey = this.buildKey(key, namespace);
    await this.cacheManager.del(fullKey);
    if (this.debug) {
      this.logger.debug(`Deleted cache key: ${fullKey}`);
    }
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