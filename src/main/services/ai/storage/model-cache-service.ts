import type { LanguageModelV2 } from '@ai-sdk/provider';

interface CacheEntry {
  model: LanguageModelV2;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
}

/**
 * 模型实例缓存服务
 * 缓存已创建的模型实例以提高性能
 */
export class ModelCacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly defaultTTL: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private options: {
      ttl?: number; // 缓存过期时间 (毫秒)
      maxSize?: number; // 最大缓存数量
      cleanupIntervalMs?: number; // 清理间隔
    } = {}
  ) {
    this.defaultTTL = options.ttl || 5 * 60 * 1000; // 默认 5 分钟

    // 启动定期清理
    if (options.cleanupIntervalMs) {
      this.startCleanup(options.cleanupIntervalMs);
    }
  }

  /**
   * 获取缓存的模型实例
   */
  get(key: string): LanguageModelV2 | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // 检查是否过期
    const now = Date.now();
    if (now - entry.createdAt > this.defaultTTL) {
      this.cache.delete(key);
      return null;
    }

    // 更新访问信息
    entry.lastAccessedAt = now;
    entry.accessCount++;

    return entry.model;
  }

  /**
   * 设置缓存
   */
  set(key: string, model: LanguageModelV2): void {
    // 检查缓存大小限制
    if (this.options.maxSize && this.cache.size >= this.options.maxSize) {
      this.evictLRU();
    }

    const now = Date.now();
    this.cache.set(key, {
      model,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0,
    });
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 生成缓存键
   */
  static generateKey(providerId: string, modelId: string, baseUrl?: string): string {
    return `${providerId}:${modelId}:${baseUrl || 'default'}`;
  }

  /**
   * 清理过期缓存
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.createdAt > this.defaultTTL) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * LRU 驱逐策略
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessedAt < oldestTime) {
        oldestTime = entry.lastAccessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * 启动定期清理
   */
  private startCleanup(intervalMs: number): void {
    this.cleanupInterval = setInterval(() => {
      const removed = this.cleanup();
      if (removed > 0) {
        console.log(`[ModelCacheService] Cleaned up ${removed} expired entries`);
      }
    }, intervalMs);
  }

  /**
   * 停止定期清理
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 获取缓存统计信息
   */
  get stats() {
    const now = Date.now();
    let totalAccess = 0;
    let expiredCount = 0;

    for (const entry of this.cache.values()) {
      totalAccess += entry.accessCount;
      if (now - entry.createdAt > this.defaultTTL) {
        expiredCount++;
      }
    }

    return {
      size: this.cache.size,
      totalAccess,
      expiredCount,
      maxSize: this.options.maxSize || Infinity,
      ttl: this.defaultTTL,
    };
  }
}
