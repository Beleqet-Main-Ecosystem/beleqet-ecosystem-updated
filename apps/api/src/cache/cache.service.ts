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
  async getOrSet<T>(key: string, fetchFn: () => Promise<T>, options?: CacheOptions): Promise<T> {
    if (options?.skipCache) {
      return fetchFn();
    }

    const fullKey = this.buildKey(key, options?.namespace);
    const ttlMs = options?.ttl ? options.ttl * 1000 : undefined; // ttl is in seconds, cache-manager expects ms

    if (this.pendingFetches.has(fullKey)) {
      if (this.debug) {
        this.logger.debug(`Coalescing fetch for key: ${fullKey}`);
      }
      return this.pendingFetches.get(fullKey) as Promise<T>;
    }

    const fetchPromise = (async () => {
      let cached: T | undefined;
      try {
        cached = await this.cacheManager.get<T>(fullKey);
      } catch (err) {
        if (this.debug) {
          this.logger.warn(`Cache read failed for key: ${fullKey}: ${(err as Error).message}`);
        }
      }
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
      try {
        await this.cacheManager.set(fullKey, data, ttlMs);
      } catch (err) {
        if (this.debug) {
          this.logger.warn(`Cache write failed for key: ${fullKey}: ${(err as Error).message}`);
        }
      }
      return data;
    })();

    // Clean up pending entry after the promise settles. Uses
    // then(success, failure) instead of finally() so a rejection does not
    // create an orphaned rejected promise.
    fetchPromise.then(
      () => {
        if (this.pendingFetches.get(fullKey) === fetchPromise) {
          this.pendingFetches.delete(fullKey);
        }
      },
      () => {
        if (this.pendingFetches.get(fullKey) === fetchPromise) {
          this.pendingFetches.delete(fullKey);
        }
      },
    );

    // Store the pending promise so concurrent calls can coalesce
    this.pendingFetches.set(fullKey, fetchPromise);

    return fetchPromise;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.buildKey(key, options?.namespace);
    const ttlMs = options?.ttl ? options.ttl * 1000 : undefined; // ttl is in seconds, cache-manager expects ms
    await this.cacheManager.set(fullKey, value, ttlMs);
    if (this.debug) {
      this.logger.debug(`Set cache for key: ${fullKey} with TTL ${options?.ttl}s`);
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
