import type { StarredRepository } from "../github/types";

// IndexedDB 数据库配置
const DB_NAME = "GitHubStarTracker";
const DB_VERSION = 1;

// 对象存储名称
const STORES = {
  REPOSITORIES: "repositories",
  METADATA: "metadata",
} as const;

// 元数据接口
interface RepositoryMetadata {
  id: string;
  lastUpdated: number;
  totalCount: number;
  etag?: string;
  userLogin: string;
}

// 缓存的仓库数据接口
interface CachedRepositoryData {
  repositories: StarredRepository[];
  metadata: RepositoryMetadata;
}

/**
 * IndexedDB 存储服务类
 * 专门用于缓存 GitHub 仓库数据到本地 IndexedDB
 */
export class IndexedDBStorageService {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * 初始化 IndexedDB 数据库
   */
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("IndexedDB 打开失败:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log("IndexedDB 数据库已打开");
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 创建 repositories 存储
        if (!db.objectStoreNames.contains(STORES.REPOSITORIES)) {
          const repoStore = db.createObjectStore(STORES.REPOSITORIES, {
            keyPath: "id",
          });

          // 创建索引以提高查询性能
          repoStore.createIndex("userLogin", "owner.login", { unique: false });
          repoStore.createIndex("starred_at", "starred_at", { unique: false });
          repoStore.createIndex("updated_at", "updated_at", { unique: false });
          repoStore.createIndex("language", "language", { unique: false });
          repoStore.createIndex("topics", "topics", { unique: false });
        }

        // 创建 metadata 存储
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: "id" });
        }

        console.log("IndexedDB 数据库结构已更新");
      };
    });

    this.db = await this.dbPromise;
    return this.db;
  }

  /**
   * 保存仓库数据到 IndexedDB
   */
  async saveRepositories(
    userLogin: string,
    repositories: StarredRepository[],
    etag?: string,
  ): Promise<void> {
    try {
      const db = await this.initDB();

      // 开始事务
      const transaction = db.transaction(
        [STORES.REPOSITORIES, STORES.METADATA],
        "readwrite",
      );

      // 清空旧数据
      const clearRequest = transaction.objectStore(STORES.REPOSITORIES).clear();

      await new Promise<void>((resolve, reject) => {
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      });

      // 批量保存新数据
      const repoStore = transaction.objectStore(STORES.REPOSITORIES);
      for (const repo of repositories) {
        repoStore.add(repo);
      }

      // 保存元数据
      const metadata: RepositoryMetadata = {
        id: `user_${userLogin}`,
        lastUpdated: Date.now(),
        totalCount: repositories.length,
        etag,
        userLogin,
      };

      const metadataStore = transaction.objectStore(STORES.METADATA);
      metadataStore.put(metadata);

      // 等待事务完成
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });

      console.log(`已保存 ${repositories.length} 个仓库到 IndexedDB`);
    } catch (error) {
      console.error("保存仓库数据到 IndexedDB 失败:", error);
      throw error;
    }
  }

  /**
   * 从 IndexedDB 加载仓库数据
   */
  async loadRepositories(userLogin: string): Promise<CachedRepositoryData | null> {
    try {
      const db = await this.initDB();

      const transaction = db.transaction([STORES.REPOSITORIES, STORES.METADATA], "readonly");

      // 获取元数据
      const metadataRequest = transaction.objectStore(STORES.METADATA).get(`user_${userLogin}`);

      const metadata = await new Promise<RepositoryMetadata | undefined>((resolve, reject) => {
        metadataRequest.onsuccess = () => resolve(metadataRequest.result);
        metadataRequest.onerror = () => reject(metadataRequest.error);
      });

      if (!metadata) {
        return null; // 没有缓存数据
      }

      // 获取所有仓库数据
      const repoRequest = transaction.objectStore(STORES.REPOSITORIES).getAll();

      const repositories = await new Promise<StarredRepository[]>((resolve, reject) => {
        repoRequest.onsuccess = () => resolve(repoRequest.result);
        repoRequest.onerror = () => reject(repoRequest.error);
      });

      console.log(`从 IndexedDB 加载了 ${repositories.length} 个仓库`);

      return {
        repositories,
        metadata,
      };
    } catch (error) {
      console.error("从 IndexedDB 加载仓库数据失败:", error);
      return null;
    }
  }

  /**
   * 检查缓存是否仍然新鲜
   */
  isCacheFresh(metadata: RepositoryMetadata, maxAge: number = 30 * 60 * 1000): boolean {
    // 默认缓存30分钟
    const now = Date.now();
    return (now - metadata.lastUpdated) < maxAge;
  }

  /**
   * 获取缓存状态信息
   */
  async getCacheStatus(userLogin: string): Promise<{
    hasCache: boolean;
    isFresh: boolean;
    lastUpdated?: Date;
    totalCount?: number;
  }> {
    try {
      const cachedData = await this.loadRepositories(userLogin);

      if (!cachedData) {
        return { hasCache: false, isFresh: false };
      }

      const isFresh = this.isCacheFresh(cachedData.metadata);

      return {
        hasCache: true,
        isFresh,
        lastUpdated: new Date(cachedData.metadata.lastUpdated),
        totalCount: cachedData.metadata.totalCount,
      };
    } catch (error) {
      console.error("获取缓存状态失败:", error);
      return { hasCache: false, isFresh: false };
    }
  }

  /**
   * 清空所有缓存数据
   */
  async clearAllCache(): Promise<void> {
    try {
      const db = await this.initDB();

      const transaction = db.transaction([STORES.REPOSITORIES, STORES.METADATA], "readwrite");

      // 清空所有数据
      transaction.objectStore(STORES.REPOSITORIES).clear();
      transaction.objectStore(STORES.METADATA).clear();

      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });

      console.log("已清空所有 IndexedDB 缓存");
    } catch (error) {
      console.error("清空 IndexedDB 缓存失败:", error);
      throw error;
    }
  }

  /**
   * 清空特定用户的缓存数据
   */
  async clearUserCache(userLogin: string): Promise<void> {
    try {
      const db = await this.initDB();

      const transaction = db.transaction([STORES.REPOSITORIES, STORES.METADATA], "readwrite");

      // 删除用户相关的仓库数据
      const repoStore = transaction.objectStore(STORES.REPOSITORIES);
      const index = repoStore.index("userLogin");
      const request = index.openCursor(IDBKeyRange.only(userLogin));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // 删除元数据
      transaction.objectStore(STORES.METADATA).delete(`user_${userLogin}`);

      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });

      console.log(`已清空用户 ${userLogin} 的 IndexedDB 缓存`);
    } catch (error) {
      console.error(`清空用户 ${userLogin} 的 IndexedDB 缓存失败:`, error);
      throw error;
    }
  }

  /**
   * 获取存储使用统计
   */
  async getStorageStats(): Promise<{
    totalRepositories: number;
    cacheSize: string;
    users: string[];
  }> {
    try {
      const db = await this.initDB();

      const transaction = db.transaction([STORES.REPOSITORIES, STORES.METADATA], "readonly");

      // 获取仓库数量
      const repoCountRequest = transaction.objectStore(STORES.REPOSITORIES).count();

      const totalRepositories = await new Promise<number>((resolve, reject) => {
        repoCountRequest.onsuccess = () => resolve(repoCountRequest.result);
        repoCountRequest.onerror = () => reject(repoCountRequest.error);
      });

      // 获取所有用户
      const metadataRequest = transaction.objectStore(STORES.METADATA).getAll();

      const metadataList = await new Promise<RepositoryMetadata[]>((resolve, reject) => {
        metadataRequest.onsuccess = () => resolve(metadataRequest.result);
        metadataRequest.onerror = () => reject(metadataRequest.error);
      });

      const users = metadataList.map(meta => meta.userLogin);

      // 估算缓存大小 (粗略计算)
      const estimatedSize = totalRepositories * 2; // 假设每个仓库平均2KB

      return {
        totalRepositories,
        cacheSize: estimatedSize > 1024
          ? `${(estimatedSize / 1024).toFixed(1)} MB`
          : `${estimatedSize} KB`,
        users,
      };
    } catch (error) {
      console.error("获取存储统计失败:", error);
      return {
        totalRepositories: 0,
        cacheSize: "0 KB",
        users: [],
      };
    }
  }
}

// 导出单例实例
export const indexedDBStorage = new IndexedDBStorageService();
export default indexedDBStorage;