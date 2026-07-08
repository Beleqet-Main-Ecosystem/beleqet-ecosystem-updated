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
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    const fullKey = this.buildKey(key, options?.namespace);
    const ttlMs = options?.ttl ? options.ttl * 1000 : undefined;

    try {
      const cached = await this.cacheManager.get<T>(fullKey);
      if (cached !== undefined && cached !== null) {
        if (this.debug) this.logger.debug(`Cache HIT: ${fullKey}`);
        return cached;
      }

      if (this.debug) this.logger.debug(`Cache MISS: ${fullKey}`);
      const data = await fetchFn();
      await this.cacheManager.set(fullKey, data, ttlMs);
      if (this.debug) this.logger.debug(`Cache SET (getOrSet): ${fullKey}, TTL: ${ttlMs}ms`);
      return data;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown Redis error';
      this.logger.warn(`Redis error, falling back: ${errMsg}`);
      return fetchFn();
    }
  }

  /**
   * Stores a value in cache with optional TTL.
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const fullKey = this.buildKey(key, options?.namespace);
    const ttlMs = options?.ttl ? options.ttl * 1000 : undefined;
    
    this.logger.log(`[SET] fullKey: ${fullKey}, value: ${JSON.stringify(value)}, ttlMs: ${ttlMs}`);

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
    this.logger.log(`[GET] fullKey: ${fullKey}`);
    try {
      const value = await this.cacheManager.get<T>(fullKey);
      this.logger.log(`[GET] result: ${JSON.stringify(value)}`);
      return value;
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Cache GET failed: ${fullKey} - ${errMsg}`);
      return undefined;
    }
  }

  /**
   * Deletes a specific cache entry.
   */
  async del(key: string, namespace?: string): Promise<void> {
    const fullKey = this.buildKey(key, namespace);
    this.logger.log(`[DEL] fullKey: ${fullKey}`);
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
   * Hashes a value to protect PII (GDPR compliance).
   */
  hashPii(value: string): string {
    return createHash('sha256')
      .update(value + this.piiSalt)
      .digest('hex')
      .substring(0, 16);
  }
}