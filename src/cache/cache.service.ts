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
    this.logger.log(`CacheService initialized with prefix: ${this.prefix}, debug: ${this.debug}`);
  }

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions,
  ): Promise<T> {
    if (options?.skipCache) {
      if (this.debug) this.logger.debug(`[skipCache] Bypassing cache for ${key}`);
      return fetchFn();
    }

    const fullKey = this.buildKey(key, options?.namespace);
    const ttlMs = options?.ttl ? options.ttl * 1000 : undefined;

    if (this.pendingFetches.has(fullKey)) {
      if (this.debug) this.logger.debug(`[Stampede] Reusing pending fetch for: ${fullKey}`);
      return this.pendingFetches.get(fullKey) as Promise<T>;
    }

    const fetchPromise = (async () => {
      try {
        const cached = await this.cacheManager.get<T>(fullKey);
        if (cached !== undefined) {
          if (this.debug) this.logger.debug(`Cache HIT: ${fullKey}${cached === null ? ' (null)' : ''}`);
          return cached;
        }

        if (this.debug) this.logger.debug(`Cache MISS: ${fullKey}`);

        let data: T;
        try {
          data = await fetchFn();
        } catch (fetchError: unknown) {
          const errMsg = fetchError instanceof Error ? fetchError.message : 'Unknown error';
          this.logger.error(`Fetch function failed for ${fullKey}: ${errMsg}`);
          throw fetchError;
        }

        await this.cacheManager.set(fullKey, data, ttlMs);
        if (this.debug) this.logger.debug(`Cache SET: ${fullKey}, TTL: ${ttlMs}ms${data === null ? ' (null)' : ''}`);
        return data;
      } catch (error: unknown) {
        throw error;
      } finally {
        this.pendingFetches.delete(fullKey);
      }
    })();

    this.pendingFetches.set(fullKey, fetchPromise);

    try {
      return await fetchPromise;
    } catch (error: unknown) {
      this.pendingFetches.delete(fullKey);
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Cache/fallback error for ${fullKey}: ${errMsg} – falling back to direct fetch`);
      return fetchFn();
    }
  }

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