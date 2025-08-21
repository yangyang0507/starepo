import type {
  StarredRepository,
  GitHubRepository,
  CacheEntry,
  CacheOptions,
  StorageAdapter,
} from "./types";

/**
 * IndexedDB存储适配器
 */
class IndexedDBAdapter implements StorageAdapter {
  private dbName = "starepo-github";
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建仓库存储
        if (!db.objectStoreNames.contains("repositories")) {
          const repoStore = db.createObjectStore("repositories", {
            keyPath: "id",
          });
          repoStore.createIndex("full_name", "full_name", { unique: true });
          repoStore.createIndex("starred_at", "starred_at");
          repoStore.createIndex("language", "language");
        }

        // 创建缓存存储
        if (!db.objectStoreNames.contains("cache")) {
          db.createObjectStore("cache", { keyPath: "key" });
        }

        // 创建同步状态存储
        if (!db.objectStoreNames.contains("sync_status")) {
          db.createObjectStore("sync_status", { keyPath: "key" });
        }
      };
    });
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["cache"], "readonly");
      const store = transaction.objectStore("cache");
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.expiresAt > Date.now()) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
    });
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["cache"], "readwrite");
      const store = transaction.objectStore("cache");

      const cacheEntry = {
        key,
        data: value,
        createdAt: Date.now(),
        expiresAt: ttl ? Date.now() + ttl : Date.now() + 24 * 60 * 60 * 1000, // 默认24小时
      };

      const request = store.put(cacheEntry);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async remove(key: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["cache"], "readwrite");
      const store = transaction.objectStore("cache");
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["cache"], "readwrite");
      const store = transaction.objectStore("cache");
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async keys(): Promise<string[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["cache"], "readonly");
      const store = transaction.objectStore("cache");
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as string[]);
    });
  }

  // 仓库特定方法
  async storeRepositories(repositories: StarredRepository[]): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["repositories"], "readwrite");
      const store = transaction.objectStore("repositories");

      let completed = 0;
      const total = repositories.length;

      if (total === 0) {
        resolve();
        return;
      }

      repositories.forEach((repo) => {
        const request = store.put(repo);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve();
          }
        };
      });
    });
  }

  async getRepositories(
    options: {
      limit?: number;
      offset?: number;
      language?: string;
      sortBy?: "starred_at" | "name" | "stargazers_count";
      sortOrder?: "asc" | "desc";
    } = {},
  ): Promise<StarredRepository[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["repositories"], "readonly");
      const store = transaction.objectStore("repositories");
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        let repositories = request.result as StarredRepository[];

        // 过滤
        if (options.language) {
          repositories = repositories.filter(
            (repo) =>
              repo.language?.toLowerCase() === options.language!.toLowerCase(),
          );
        }

        // 排序
        if (options.sortBy) {
          repositories.sort((a, b) => {
            let aValue: any, bValue: any;

            switch (options.sortBy) {
              case "starred_at":
                aValue = new Date(a.starred_at).getTime();
                bValue = new Date(b.starred_at).getTime();
                break;
              case "name":
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
                break;
              case "stargazers_count":
                aValue = a.stargazers_count;
                bValue = b.stargazers_count;
                break;
              default:
                return 0;
            }

            const result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            return options.sortOrder === "desc" ? -result : result;
          });
        }

        // 分页
        if (options.offset || options.limit) {
          const start = options.offset || 0;
          const end = options.limit ? start + options.limit : undefined;
          repositories = repositories.slice(start, end);
        }

        resolve(repositories);
      };
    });
  }

  async getRepositoryByFullName(
    fullName: string,
  ): Promise<StarredRepository | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["repositories"], "readonly");
      const store = transaction.objectStore("repositories");
      const index = store.index("full_name");
      const request = index.get(fullName);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async removeRepository(fullName: string): Promise<void> {
    if (!this.db) await this.init();

    const repo = await this.getRepositoryByFullName(fullName);
    if (!repo) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["repositories"], "readwrite");
      const store = transaction.objectStore("repositories");
      const request = store.delete(repo.id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async getRepositoryCount(): Promise<number> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["repositories"], "readonly");
      const store = transaction.objectStore("repositories");
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }
}

/**
 * 内存缓存适配器
 */
class MemoryAdapter implements StorageAdapter {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 1000; // 最大缓存条目数

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;

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
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl,
    });
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
}

/**
 * GitHub数据存储服务
 * 提供多层缓存和持久化存储
 */
export class GitHubStorageService {
  private memoryAdapter: MemoryAdapter;
  private indexedDBAdapter: IndexedDBAdapter;
  private initialized = false;

  constructor() {
    this.memoryAdapter = new MemoryAdapter();
    this.indexedDBAdapter = new IndexedDBAdapter();
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    await this.indexedDBAdapter.init();
    this.initialized = true;
  }

  /**
   * 获取缓存数据
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    const { useMemory = true, useIndexedDB = true } = options;

    // 先尝试内存缓存
    if (useMemory) {
      const memoryResult = await this.memoryAdapter.get<T>(key);
      if (memoryResult !== null) {
        return memoryResult;
      }
    }

    // 再尝试IndexedDB
    if (useIndexedDB) {
      await this.init();
      const dbResult = await this.indexedDBAdapter.get<T>(key);
      if (dbResult !== null && useMemory) {
        // 回填到内存缓存
        await this.memoryAdapter.set(key, dbResult, options.ttl);
      }
      return dbResult;
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
    const { useMemory = true, useIndexedDB = true, ttl } = options;

    const promises: Promise<void>[] = [];

    if (useMemory) {
      promises.push(this.memoryAdapter.set(key, value, ttl));
    }

    if (useIndexedDB) {
      await this.init();
      promises.push(this.indexedDBAdapter.set(key, value, ttl));
    }

    await Promise.all(promises);
  }

  /**
   * 删除缓存数据
   */
  async remove(key: string): Promise<void> {
    const promises = [
      this.memoryAdapter.remove(key),
      this.indexedDBAdapter.remove(key),
    ];

    await Promise.all(promises);
  }

  /**
   * 清除所有缓存
   */
  async clear(): Promise<void> {
    const promises = [
      this.memoryAdapter.clear(),
      this.indexedDBAdapter.clear(),
    ];

    await Promise.all(promises);
  }

  /**
   * 存储仓库数据
   */
  async storeRepositories(repositories: StarredRepository[]): Promise<void> {
    await this.init();
    await this.indexedDBAdapter.storeRepositories(repositories);

    // 同时缓存到内存（限制数量）
    const recentRepos = repositories.slice(0, 100);
    await this.memoryAdapter.set("recent_repositories", recentRepos);
  }

  /**
   * 获取仓库数据
   */
  async getRepositories(
    options: {
      limit?: number;
      offset?: number;
      language?: string;
      sortBy?: "starred_at" | "name" | "stargazers_count";
      sortOrder?: "asc" | "desc";
      useCache?: boolean;
    } = {},
  ): Promise<StarredRepository[]> {
    const { useCache = true, ...queryOptions } = options;

    // 生成缓存键
    const cacheKey = `repositories_${JSON.stringify(queryOptions)}`;

    if (useCache) {
      const cached = await this.get<StarredRepository[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    await this.init();
    const repositories =
      await this.indexedDBAdapter.getRepositories(queryOptions);

    if (useCache) {
      await this.set(cacheKey, repositories, { ttl: 5 * 60 * 1000 }); // 5分钟缓存
    }

    return repositories;
  }

  /**
   * 根据全名获取仓库
   */
  async getRepositoryByFullName(
    fullName: string,
  ): Promise<StarredRepository | null> {
    const cacheKey = `repository_${fullName}`;

    const cached = await this.get<StarredRepository>(cacheKey);
    if (cached) {
      return cached;
    }

    await this.init();
    const repository =
      await this.indexedDBAdapter.getRepositoryByFullName(fullName);

    if (repository) {
      await this.set(cacheKey, repository, { ttl: 10 * 60 * 1000 }); // 10分钟缓存
    }

    return repository;
  }

  /**
   * 删除仓库
   */
  async removeRepository(fullName: string): Promise<void> {
    await this.init();
    await this.indexedDBAdapter.removeRepository(fullName);

    // 清除相关缓存
    await this.remove(`repository_${fullName}`);
  }

  /**
   * 获取仓库总数
   */
  async getRepositoryCount(): Promise<number> {
    const cacheKey = "repository_count";

    const cached = await this.get<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    await this.init();
    const count = await this.indexedDBAdapter.getRepositoryCount();

    await this.set(cacheKey, count, { ttl: 60 * 1000 }); // 1分钟缓存

    return count;
  }

  /**
   * 搜索仓库
   */
  async searchRepositories(
    query: string,
    options: {
      language?: string;
      limit?: number;
    } = {},
  ): Promise<StarredRepository[]> {
    const { language, limit = 50 } = options;

    const allRepos = await this.getRepositories({
      language,
      limit: 1000, // 获取更多数据用于搜索
      useCache: true,
    });

    const searchTerms = query
      .toLowerCase()
      .split(" ")
      .filter((term) => term.length > 0);

    const filteredRepos = allRepos.filter((repo) => {
      const searchText = [
        repo.name,
        repo.full_name,
        repo.description || "",
        ...(repo.topics || []),
      ]
        .join(" ")
        .toLowerCase();

      return searchTerms.every((term) => searchText.includes(term));
    });

    return filteredRepos.slice(0, limit);
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<{
    repositoryCount: number;
    cacheSize: number;
    memoryKeys: string[];
    indexedDBKeys: string[];
  }> {
    await this.init();

    const [repositoryCount, memoryKeys, indexedDBKeys] = await Promise.all([
      this.getRepositoryCount(),
      this.memoryAdapter.keys(),
      this.indexedDBAdapter.keys(),
    ]);

    return {
      repositoryCount,
      cacheSize: memoryKeys.length + indexedDBKeys.length,
      memoryKeys,
      indexedDBKeys,
    };
  }
}

// 导出单例实例
export const githubStorageService = new GitHubStorageService();
export default githubStorageService;
