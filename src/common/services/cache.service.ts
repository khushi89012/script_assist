import { Injectable, Logger } from '@nestjs/common';

interface CacheItem {
  value: any;
  expiresAt: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private cache: Record<string, CacheItem> = {};
  private cacheSize = 0;
  private readonly MAX_CACHE_SIZE = 1000; // Limit cache size to 1000 items

  // Set a cache item with TTL (Time-to-Live)
  async set(key: string, value: any, ttlSeconds = 300): Promise<void> {
    // Validate input
    if (!key || !value) {
      this.logger.error('Invalid key or value provided for cache');
      return;
    }

    // Serialize complex objects
    const serializedValue = JSON.stringify(value);
    
    const expiresAt = Date.now() + ttlSeconds * 1000;

    // Namespacing: If needed, add a prefix to the key for a namespace
    const namespacedKey = `namespace:${key}`;

    // Store the value
    this.cache[namespacedKey] = {
      value: serializedValue,
      expiresAt,
    };

    this.cacheSize++;

    // Handle eviction if cache exceeds size limit
    if (this.cacheSize > this.MAX_CACHE_SIZE) {
      this.evict();
    }
  }

  // Get a cache item by key
  async get<T>(key: string): Promise<T | null> {
    const namespacedKey = `namespace:${key}`;
    const item = this.cache[namespacedKey];

    if (!item) {
      return null;
    }

    // Check expiration
    if (item.expiresAt < Date.now()) {
      delete this.cache[namespacedKey];
      this.cacheSize--;
      return null;
    }

    // Deserialize before returning
    return JSON.parse(item.value) as T;
  }

  // Delete a cache item by key
  async delete(key: string): Promise<boolean> {
    const namespacedKey = `namespace:${key}`;
    if (namespacedKey in this.cache) {
      delete this.cache[namespacedKey];
      this.cacheSize--;
      return true;
    }
    return false;
  }

  // Clear the entire cache
  async clear(): Promise<void> {
    this.cache = {};
    this.cacheSize = 0;
    this.logger.log('Cache cleared');
  }

  // Check if a cache item exists
  async has(key: string): Promise<boolean> {
    const namespacedKey = `namespace:${key}`;
    const item = this.cache[namespacedKey];
    if (!item) {
      return false;
    }

    // Check expiration
    if (item.expiresAt < Date.now()) {
      delete this.cache[namespacedKey];
      this.cacheSize--;
      return false;
    }

    return true;
  }

  // Eviction logic: Remove least recently used (LRU) items
  private evict(): void {
    const keys = Object.keys(this.cache);
    if (keys.length > 0) {
      // Evict the first item in the cache (LRU)
      const oldestKey = keys[0];
      delete this.cache[oldestKey];
      this.cacheSize--;
      this.logger.log(`Cache size exceeded. Evicted key: ${oldestKey}`);
    }
  }

  // Bulk set: Set multiple cache items at once
  async setMultiple(items: Record<string, any>, ttlSeconds = 300): Promise<void> {
    for (const [key, value] of Object.entries(items)) {
      await this.set(key, value, ttlSeconds);
    }
  }

  // Bulk get: Get multiple cache items at once
  async getMultiple<T>(keys: string[]): Promise<(T | null)[]> {
    const results: (T | null)[] = [];
    for (const key of keys) {
      const value = await this.get<T>(key);
      results.push(value);
    }
    return results;
  }

  // Cache statistics: Track usage (e.g., number of keys, cache size)
  getCacheStats(): { size: number } {
    return { size: this.cacheSize };
  }
}
