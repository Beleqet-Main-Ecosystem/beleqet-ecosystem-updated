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

  // Stampede protection: deduplicate concurrent requests
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
   * Implements cache‑aside pattern with stampede protection and negative caching.
   *
   * @param key - Unique cache key (will be namespaced with prefix)
   * @param fetchFn - Async function to fetch data on cache miss
   * @param options - Optional TTL (seconds), skipCache, namespace, etc.
   * @returns The cached or freshly fetched data (can be null for negative caching)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    // Support skipCache
    if (options?.skipCache) {
      if (this.debug) this.logger.debug(`[skipCache] Bypassing cache for ${key}`);
      return fetchFn();
    }

    const fullKey = this.buildKey(key, options?.namespace);
    const ttlMs = options?.ttl ? options.ttl * 1000 : undefined;

    // Stampede protection – check if a fetch is already pending
    if (this.pendingFetches.has(fullKey)) {
      if (this.debug) this.logger.debug(`[Stampede] Reusing pending fetch for: ${fullKey}`);
      return this.pendingFetches.get(fullKey) as Promise<T>;
    }

    // Create the fetch promise immediately (synchronously) to avoid race conditions
    const fetchPromise = (async () => {
      try {
        // Check cache
        const cached = await this.cacheManager.get<T>(fullKey);
        // Negative caching: allow null values (only undefined means miss)
        if (cached !== undefined) {
          if (this.debug) this.logger.debug(`Cache HIT: ${fullKey}${cached === null ? ' (null)' : ''}`);
          return cached;
        }

        if (this.debug) this.logger.debug(`Cache MISS: ${fullKey}`);

        // Separate error handling for fetchFn (to avoid mislabeling DB errors)
        let data: T;
        try {
          data = await fetchFn();
        } catch (fetchError: unknown) {
          // DB/application error – log and rethrow (do NOT retry)
          const errMsg = fetchError instanceof Error ? fetchError.message : 'Unknown error';
          this.logger.error(`Fetch function failed for ${fullKey}: ${errMsg}`);
          throw fetchError;
        }

        // Store in cache (allow null values)
        await this.cacheManager.set(fullKey, data, ttlMs);
        if (this.debug) this.logger.debug(`Cache SET: ${fullKey}, TTL: ${ttlMs}ms${data === null ? ' (null)' : ''}`);
        return data;
      } catch (error: unknown) {
        // Re-throw so the outer catch can handle fallback
        throw error;
      } finally {
        // Clean up the pending promise when done
        this.pendingFetches.delete(fullKey);
      }
    })();

    // Store the promise immediately to prevent any race condition
    this.pendingFetches.set(fullKey, fetchPromise);

    try {
      return await fetchPromise;
    } catch (error: unknown) {
      // If Redis or fetch fails, we fallback to fetchFn directly
      this.pendingFetches.delete(fullKey);
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Cache/fallback error for ${fullKey}: ${errMsg} – falling back to direct fetch`);
      return fetchFn();
    }
  }

  /**
   * Stores a value in cache with optional TTL.
   * @param key - Cache key
   * @param value - Value to store (can be null)
   * @param options - TTL in seconds (converted to ms internally) and namespace
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
   * @param key - Cache key
   * @param namespace - Optional namespace
   * @returns Cached value or undefined if not found
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
   * Hashes a value to protect PII (GDPR compliance) – 32 characters of SHA-256.
   * @param value - Sensitive value (e.g., userId, email)
   * @returns SHA‑256 hash (first 32 chars)
   */
  hashPii(value: string): string {
    return createHash('sha256')
      .update(value + this.piiSalt)
      .digest('hex')
      .substring(0, 32);
  }
}