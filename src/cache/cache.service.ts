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
   * @param key - Cache key (will be prefixed and optionally namespaced)
   * @param fetchFn - Function that returns a Promise with fresh data
   * @param options - Cache options (TTL in seconds, namespace, skipCache)
   * @returns The cached or freshly fetched value
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
    const ttlSeconds = options?.ttl; // in seconds, as expected by cache-manager

    // If there's already a pending fetch for this key, return that promise
    if (this.pendingFetches.has(fullKey)) {
      if (this.debug) {
        this.logger.debug(`Coalescing fetch for key: ${fullKey}`);
      }
      return this.pendingFetches.get(fullKey) as Promise<T>;
    }

    // Create the fetch promise (coalescing)
    const fetchPromise = (async () => {
      try {
        // 1. Check cache
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

        // 2. Fetch fresh data
        const data = await fetchFn();

        // 3. Store in cache
        await this.cacheManager.set(fullKey, data, ttlSeconds);
        return data;
      } finally {
        // Clean up the pending entry after the promise settles
        // Only remove if it's still the same promise (avoid race conditions)
        if (this.pendingFetches.get(fullKey) === fetchPromise) {
          this.pendingFetches.delete(fullKey);
        }
      }
    })();

    // Store the pending promise BEFORE any await (so concurrent calls can see it)
    this.pendingFetches.set(fullKey, fetchPromise);

    // Return the promise – callers will await it and handle errors themselves
    return fetchPromise;
  }

  /**
   * Store a value in the cache.
   * @param key - Cache key
   * @param value - Value to store
   * @param options - Cache options (TTL in seconds, namespace)
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.buildKey(key, options?.namespace);
    const ttlSeconds = options?.ttl; // in seconds
    await this.cacheManager.set(fullKey, value, ttlSeconds);
    if (this.debug) {
      this.logger.debug(`Set cache for key: ${fullKey} with TTL ${ttlSeconds}s`);
    }
  }

  /**
   * Get a value from the cache.
   * @param key - Cache key
   * @param namespace - Optional namespace
   * @returns The cached value or undefined if not found
   */
  async get<T>(key: string, namespace?: string): Promise<T | undefined> {
    const fullKey = this.buildKey(key, namespace);
    return this.cacheManager.get<T>(fullKey);
  }

  /**
   * Delete a key from the cache.
   * @param key - Cache key
   * @param namespace - Optional namespace
   */
  async del(key: string, namespace?: string): Promise<void> {
    const fullKey = this.buildKey(key, namespace);
    await this.cacheManager.del(fullKey);
    if (this.debug) {
      this.logger.debug(`Deleted cache key: ${fullKey}`);
    }
  }

  /**
   * Build a fully qualified cache key with optional namespace and prefix.
   * @param key - Base key
   * @param namespace - Optional namespace
   * @param hashPii - If true, hash the key (for PII data)
   * @returns Full cache key
   */
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

  /**
   * Hash a string for PII protection.
   * @param value - Value to hash
   * @returns SHA-256 hash (first 32 chars)
   */
  hashPii(value: string): string {
    return createHash('sha256')
      .update(value + this.piiSalt)
      .digest('hex')
      .substring(0, 32);
  }
}