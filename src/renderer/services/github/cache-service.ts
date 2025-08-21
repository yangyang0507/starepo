import type {
  CacheEntry,
  CacheOptions,
  GitHubRepository,
  StarredRepository,
  GitHubUser,
  StorageAdapter,
} from "./types";

/**
 * 内存缓存适配器
 */
class MemoryCacheAdapter implements StorageAdapter {
  private cache = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  async set<T>(
    key: string,
    value: T,
    ttl: number = 5 * 60 * 1000,
  ): Promise<void> {
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl,
    };
    this.cache.set(key, entry);
  }

  async remove(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async keys(): Promise<string[]> {
    return Array.from(this.cache.keys());
  }

  /**
   * 清理过期缓存
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number;
    keys: string[];
    memoryUsage: number;
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      memoryUsage: JSON.stringify(Array.from(this.cache.entries())).length,
    };
  }
}

/**
 * IndexedDB缓存适配器
 */
class IndexedDBCacheAdapter implements StorageAdapter {
  private dbName = "starepo-cache";
  private dbVersion = 1;
  private storeName = "cache";
  private db: IDBDatabase | null = null;

  constructor() {
    this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "key" });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    if (!this.db) {
      throw new Error("IndexedDB初始化失败");
    }
    return this.db;
  }

  async get<T>(key: string): Promise<T | null> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }

        const entry = result as { key: string; data: CacheEntry<T> };

        // 检查是否过期
        if (Date.now() > entry.data.timestamp + entry.data.ttl) {
          this.remove(key); // 异步删除过期数据
          resolve(null);
          return;
        }

        resolve(entry.data.data);
      };
    });
  }

  async set<T>(
    key: string,
    value: T,
    ttl: number = 30 * 60 * 1000,
  ): Promise<void> {
    const db = await this.ensureDB();
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put({ key, data: entry });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async remove(key: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async keys(): Promise<string[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }

  /**
   * 清理过期缓存
   */
  async cleanup(): Promise<void> {
    const keys = await this.keys();
    const now = Date.now();

    for (const key of keys) {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result && now > result.data.timestamp + result.data.ttl) {
          this.remove(key);
        }
      };
    }
  }
}

/**
 * 多层缓存管理服务
 */
export class GitHubCacheService {
  private memoryCache: MemoryCacheAdapter;
  private persistentCache: IndexedDBCacheAdapter;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.memoryCache = new MemoryCacheAdapter();
    this.persistentCache = new IndexedDBCacheAdapter();
    this.startCleanupScheduler();
  }

  /**
   * 获取缓存数据
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const { useMemory = true, useIndexedDB = true } = options;

    // 首先尝试内存缓存
    if (useMemory) {
      const memoryResult = await this.memoryCache.get<T>(key);
      if (memoryResult !== null) {
        return memoryResult;
      }
    }

    // 然后尝试持久化缓存
    if (useIndexedDB) {
      const persistentResult = await this.persistentCache.get<T>(key);
      if (persistentResult !== null) {
        // 将数据回写到内存缓存
        if (useMemory) {
          await this.memoryCache.set(key, persistentResult, options.ttl);
        }
        return persistentResult;
      }
    }

    return null;
  }

  /**
   * 设置缓存数据
   */
  async set<T>(
    key: string,
    value: T,
    options: CacheOptions = {},
  ): Promise<void> {
    const {
      ttl = 5 * 60 * 1000, // 默认5分钟
      useMemory = true,
      useIndexedDB = true,
    } = options;

    const promises: Promise<void>[] = [];

    if (useMemory) {
      promises.push(this.memoryCache.set(key, value, ttl));
    }

    if (useIndexedDB) {
      promises.push(this.persistentCache.set(key, value, ttl));
    }

    await Promise.all(promises);
  }

  /**
   * 删除缓存数据
   */
  async remove(key: string): Promise<void> {
    await Promise.all([
      this.memoryCache.remove(key),
      this.persistentCache.remove(key),
    ]);
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    await Promise.all([this.memoryCache.clear(), this.persistentCache.clear()]);
  }

  /**
   * 获取所有缓存键
   */
  async keys(): Promise<string[]> {
    const [memoryKeys, persistentKeys] = await Promise.all([
      this.memoryCache.keys(),
      this.persistentCache.keys(),
    ]);

    return Array.from(new Set([...memoryKeys, ...persistentKeys]));
  }

  /**
   * 缓存用户信息
   */
  async cacheUser(user: GitHubUser): Promise<void> {
    const key = `user:${user.login}`;
    await this.set(key, user, {
      ttl: 10 * 60 * 1000, // 10分钟
      useMemory: true,
      useIndexedDB: true,
    });
  }

  /**
   * 获取缓存的用户信息
   */
  async getCachedUser(login: string): Promise<GitHubUser | null> {
    const key = `user:${login}`;
    return this.get<GitHubUser>(key);
  }

  /**
   * 缓存仓库信息
   */
  async cacheRepository(repo: GitHubRepository): Promise<void> {
    const key = `repo:${repo.full_name}`;
    await this.set(key, repo, {
      ttl: 15 * 60 * 1000, // 15分钟
      useMemory: true,
      useIndexedDB: true,
    });
  }

  /**
   * 获取缓存的仓库信息
   */
  async getCachedRepository(
    fullName: string,
  ): Promise<GitHubRepository | null> {
    const key = `repo:${fullName}`;
    return this.get<GitHubRepository>(key);
  }

  /**
   * 缓存Star仓库列表
   */
  async cacheStarredRepositories(
    username: string,
    repositories: StarredRepository[],
    page: number = 1,
  ): Promise<void> {
    const key = `starred:${username}:page:${page}`;
    await this.set(key, repositories, {
      ttl: 5 * 60 * 1000, // 5分钟
      useMemory: true,
      useIndexedDB: true,
    });
  }

  /**
   * 获取缓存的Star仓库列表
   */
  async getCachedStarredRepositories(
    username: string,
    page: number = 1,
  ): Promise<StarredRepository[] | null> {
    const key = `starred:${username}:page:${page}`;
    return this.get<StarredRepository[]>(key);
  }

  /**
   * 缓存搜索结果
   */
  async cacheSearchResults(
    query: string,
    results: GitHubRepository[],
    page: number = 1,
  ): Promise<void> {
    const key = `search:${encodeURIComponent(query)}:page:${page}`;
    await this.set(key, results, {
      ttl: 2 * 60 * 1000, // 2分钟
      useMemory: true,
      useIndexedDB: false, // 搜索结果不持久化
    });
  }

  /**
   * 获取缓存的搜索结果
   */
  async getCachedSearchResults(
    query: string,
    page: number = 1,
  ): Promise<GitHubRepository[] | null> {
    const key = `search:${encodeURIComponent(query)}:page:${page}`;
    return this.get<GitHubRepository[]>(key, {
      useMemory: true,
      useIndexedDB: false,
    });
  }

  /**
   * 预热缓存
   */
  async warmup(data: {
    user?: GitHubUser;
    repositories?: GitHubRepository[];
    starredRepositories?: { username: string; repos: StarredRepository[] };
  }): Promise<void> {
    const promises: Promise<void>[] = [];

    if (data.user) {
      promises.push(this.cacheUser(data.user));
    }

    if (data.repositories) {
      for (const repo of data.repositories) {
        promises.push(this.cacheRepository(repo));
      }
    }

    if (data.starredRepositories) {
      promises.push(
        this.cacheStarredRepositories(
          data.starredRepositories.username,
          data.starredRepositories.repos,
        ),
      );
    }

    await Promise.all(promises);
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    memory: {
      size: number;
      keys: string[];
      memoryUsage: number;
    };
    persistent: {
      available: boolean;
    };
  } {
    return {
      memory: this.memoryCache.getStats(),
      persistent: {
        available: typeof indexedDB !== "undefined",
      },
    };
  }

  /**
   * 开始清理调度器
   */
  private startCleanupScheduler(): void {
    // 每5分钟清理一次过期缓存
    this.cleanupInterval = setInterval(
      () => {
        this.memoryCache.cleanup();
        this.persistentCache.cleanup();
      },
      5 * 60 * 1000,
    );
  }

  /**
   * 停止清理调度器
   */
  private stopCleanupScheduler(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 销毁缓存服务
   */
  destroy(): void {
    this.stopCleanupScheduler();
    this.memoryCache.clear();
    this.persistentCache.clear();
  }
}

// 导出单例实例
export const githubCacheService = new GitHubCacheService();
export default githubCacheService;
