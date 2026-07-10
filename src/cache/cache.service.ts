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

  /**
   * 🔥 FIX 5: Cache Stampede Protection
   * Deduplicates concurrent requests for the same key to prevent
   * multiple database queries when cache expires simultaneously.
   */
  private readonly pendingFetches = new Map<string, Promise<any>>();

  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
  ) {
    this.prefix = this.configService.get<string>('redis.prefix') || 'beleqet:';
    this.piiSalt = this.configService.get<string>('security.piiSalt') || 'default-salt';
    this.debug = this.configService.get<boolean>('redis.debug') || false;
    this.logger.log(`CacheService initialized with prefix: ${this.prefix}, debug: ${this.debug}`);
  }

  /**
   * Retrieves data from cache or fetches it from the source.
   * Implements cache‑aside pattern with automatic population.
   * 🔥 Includes stampede protection to prevent concurrent DB overload.
   *
   * @param key - Unique cache key (will be namespaced with prefix)
   * @param fetchFn - Async function to fetch data on cache miss
   * @param options - Optional TTL (in seconds) or other cache options
   * @returns The cached or freshly fetched data
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const fullKey = this.buildKey(key, options?.namespace);
    // Convert seconds → milliseconds for cache-manager
    const ttlMs = options?.ttl ? options.ttl * 1000 : undefined;

    // 🔥 FIX 5: Check if there's already a pending fetch for this key
    if (this.pendingFetches.has(fullKey)) {
      if (this.debug) {
        this.logger.debug(`[Stampede] Reusing pending fetch for: ${fullKey}`);
      }
      return this.pendingFetches.get(fullKey) as Promise<T>;
    }

    try {
      const cached = await this.cacheManager.get<T>(fullKey);
      if (cached !== undefined && cached !== null) {
        if (this.debug) this.logger.debug(`Cache HIT: ${fullKey}`);
        return cached;
      }

      if (this.debug) this.logger.debug(`Cache MISS: ${fullKey}`);

      // 🔥 FIX 5: Store the fetch promise to deduplicate concurrent requests
      const fetchPromise = fetchFn().then(async (data) => {
        await this.cacheManager.set(fullKey, data, ttlMs);
        if (this.debug) this.logger.debug(`Cache SET: ${fullKey}, TTL: ${ttlMs}ms`);
        return data;
      });

      this.pendingFetches.set(fullKey, fetchPromise);

      const result = await fetchPromise;
      this.pendingFetches.delete(fullKey);
      return result;
    } catch (error: unknown) {
      // Clean up on error
      this.pendingFetches.delete(fullKey);
      const errMsg = error instanceof Error ? error.message : 'Unknown Redis error';
      this.logger.warn(`Redis error, falling back to fetchFn: ${errMsg}`);
      return fetchFn();
    }
  }

  /**
   * Stores a value in cache with optional TTL.
   * @param key - Cache key
   * @param value - Value to store
   * @param options - TTL in seconds (converted to ms internally)
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.buildKey(key, options?.namespace);
    const ttlMs = options?.ttl ? options.ttl * 1000 : undefined;

    if (this.debug) {
      this.logger.debug(`[SET] fullKey: ${fullKey}, value: ${JSON.stringify(value)}, ttlMs: ${ttlMs}`);
    }

    try {
      await this.cacheManager.set(fullKey, value, ttlMs);
      if (this.debug) this.logger.debug(`Cache SET: ${fullKey}, TTL: ${ttlMs}ms`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Cache SET failed: ${fullKey} - ${errMsg}`);
      throw error;
    }
  }

  /**
   * Retrieves a value from cache.
   */
  async get<T>(key: string, namespace?: string): Promise<T | undefined> {
    const fullKey = this.buildKey(key, namespace);
    if (this.debug) this.logger.debug(`[GET] fullKey: ${fullKey}`);

    try {
      const value = await this.cacheManager.get<T>(fullKey);
      if (this.debug) this.logger.debug(`[GET] result: ${JSON.stringify(value)}`);
      return value;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Cache GET failed: ${fullKey} - ${errMsg}`);
      return undefined;
    }
  }

  /**
   * Deletes a specific cache entry.
   * Use this for targeted invalidation on update/delete operations.
   */
  async del(key: string, namespace?: string): Promise<void> {
    const fullKey = this.buildKey(key, namespace);
    if (this.debug) this.logger.debug(`[DEL] fullKey: ${fullKey}`);

    try {
      await this.cacheManager.del(fullKey);
      if (this.debug) this.logger.debug(`Cache DEL: ${fullKey}`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Cache DEL failed: ${fullKey} - ${errMsg}`);
      throw error;
    }
  }

  /**
   * Builds a namespaced cache key.
   * @param key - Raw key
   * @param namespace - Optional namespace
   * @param hashPii - If true, hashes the key to protect PII (GDPR)
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
   * 🔥 FIX 6: Hashes a value to protect PII (GDPR compliance).
   * Extended to 32 characters to significantly reduce collision risk.
   *
   * @param value - Sensitive value (e.g., userId, email)
   * @returns SHA‑256 hash (first 32 chars)
   */
  hashPii(value: string): string {
    return createHash('sha256')
      .update(value + this.piiSalt)
      .digest('hex')
      .substring(0, 32); // 🔥 Changed from 16 to 32 chars
  }
}