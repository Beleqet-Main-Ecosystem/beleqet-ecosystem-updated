import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Injectable()
export class RedisCacheService {
  private readonly logger = new Logger(RedisCacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  /**
   * Returns a cached value when available, otherwise loads and stores a fresh value.
   */
  async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttlMs: number,
    registryKey?: string,
  ): Promise<T> {
    try {
      const cached = await this.cache.get<T>(key);
      if (cached !== undefined) {
        return cached;
      }
    } catch (error) {
      this.warn('Cache read failed', error);
    }

    const value = await loader();

    try {
      await this.cache.set(key, value, ttlMs);
      if (registryKey) {
        await this.registerKey(registryKey, key, ttlMs);
      }
    } catch (error) {
      this.warn('Cache write failed', error);
    }

    return value;
  }

  /**
   * Deletes one cache key and logs only operational metadata if Redis fails.
   */
  async delete(key: string): Promise<void> {
    try {
      await this.cache.del(key);
    } catch (error) {
      this.warn('Cache delete failed', error);
    }
  }

  /**
   * Deletes every key recorded in a registry and then clears the registry itself.
   */
  async invalidateRegisteredKeys(registryKey: string): Promise<void> {
    try {
      const registeredKeys = (await this.cache.get<string[]>(registryKey)) ?? [];
      const keysToDelete = [...registeredKeys, registryKey];

      if (keysToDelete.length === 1) {
        await this.cache.del(registryKey);
        return;
      }

      await this.cache.mdel(keysToDelete);
    } catch (error) {
      this.warn('Cache registry invalidation failed', error);
    }
  }

  /**
   * Records a generated cache key so later mutations can invalidate that group.
   */
  private async registerKey(registryKey: string, key: string, ttlMs: number): Promise<void> {
    const registeredKeys = (await this.cache.get<string[]>(registryKey)) ?? [];
    if (registeredKeys.includes(key)) {
      return;
    }

    const registryTtlMs = ttlMs + 60_000;
    await this.cache.set(registryKey, [...registeredKeys, key], registryTtlMs);
  }

  /**
   * Writes a concise cache warning without exposing cached payload contents.
   */
  private warn(message: string, error: unknown): void {
    const detail = error instanceof Error ? error.message : String(error);
    this.logger.warn(`${message}: ${detail}`);
  }
}

