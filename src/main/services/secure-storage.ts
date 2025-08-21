import { safeStorage } from "electron";
import { app } from "electron";
import * as path from "path";
import * as fs from "fs/promises";

export interface SecureStorageItem {
  key: string;
  value: string;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

export interface StorageMetadata {
  version: string;
  createdAt: number;
  lastAccessed: number;
}

export class SecureStorageService {
  private static instance: SecureStorageService;
  private readonly storageDir: string;
  private readonly metadataFile: string;
  private isInitialized = false;

  private constructor() {
    this.storageDir = path.join(app.getPath("userData"), "secure-storage");
    this.metadataFile = path.join(this.storageDir, "metadata.json");
  }

  static getInstance(): SecureStorageService {
    if (!SecureStorageService.instance) {
      SecureStorageService.instance = new SecureStorageService();
    }
    return SecureStorageService.instance;
  }

  // 初始化安全存储
  async initialize(): Promise<void> {
    try {
      // 检查 safeStorage 是否可用
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("系统不支持安全存储加密功能");
      }

      // 创建存储目录
      await this.ensureStorageDirectory();

      // 初始化元数据
      await this.initializeMetadata();

      this.isInitialized = true;
      console.log("安全存储服务初始化成功");
    } catch (error) {
      console.error("安全存储服务初始化失败:", error);
      throw error;
    }
  }

  // 存储加密数据
  async setItem(key: string, value: string, expiresIn?: number): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // 加密数据
      const encryptedValue = safeStorage.encryptString(value);

      const item: SecureStorageItem = {
        key,
        value: encryptedValue.toString("base64"),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: expiresIn ? Date.now() + expiresIn : undefined,
      };

      // 保存到文件
      const filePath = this.getItemFilePath(key);
      await fs.writeFile(filePath, JSON.stringify(item, null, 2), "utf8");

      // 更新元数据
      await this.updateMetadata();

      console.log(`安全存储项目已保存: ${key}`);
    } catch (error) {
      console.error(`保存安全存储项目失败 (${key}):`, error);
      throw new Error(
        `保存安全存储项目失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  // 获取解密数据
  async getItem(key: string): Promise<string | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const filePath = this.getItemFilePath(key);

      // 检查文件是否存在
      try {
        await fs.access(filePath);
      } catch {
        return null; // 文件不存在
      }

      // 读取文件
      const fileContent = await fs.readFile(filePath, "utf8");
      const item: SecureStorageItem = JSON.parse(fileContent);

      // 检查是否过期
      if (item.expiresAt && Date.now() > item.expiresAt) {
        await this.removeItem(key);
        return null;
      }

      // 解密数据
      const encryptedBuffer = Buffer.from(item.value, "base64");
      const decryptedValue = safeStorage.decryptString(encryptedBuffer);

      // 更新元数据
      await this.updateMetadata();

      return decryptedValue;
    } catch (error) {
      console.error(`获取安全存储项目失败 (${key}):`, error);
      return null;
    }
  }

  // 删除存储项目
  async removeItem(key: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const filePath = this.getItemFilePath(key);

      try {
        await fs.unlink(filePath);
        console.log(`安全存储项目已删除: ${key}`);
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          throw error;
        }
        // 文件不存在，忽略错误
      }

      // 更新元数据
      await this.updateMetadata();
    } catch (error) {
      console.error(`删除安全存储项目失败 (${key}):`, error);
      throw new Error(
        `删除安全存储项目失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  // 检查项目是否存在
  async hasItem(key: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const filePath = this.getItemFilePath(key);
      await fs.access(filePath);

      // 检查是否过期
      const fileContent = await fs.readFile(filePath, "utf8");
      const item: SecureStorageItem = JSON.parse(fileContent);

      if (item.expiresAt && Date.now() > item.expiresAt) {
        await this.removeItem(key);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  // 获取所有存储的键
  async getAllKeys(): Promise<string[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const files = await fs.readdir(this.storageDir);
      const keys: string[] = [];

      for (const file of files) {
        if (file.endsWith(".json") && file !== "metadata.json") {
          const key = file.replace(".json", "");
          if (await this.hasItem(key)) {
            keys.push(key);
          }
        }
      }

      return keys;
    } catch (error) {
      console.error("获取存储键列表失败:", error);
      return [];
    }
  }

  // 清空所有存储
  async clear(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const keys = await this.getAllKeys();

      for (const key of keys) {
        await this.removeItem(key);
      }

      console.log("所有安全存储项目已清空");
    } catch (error) {
      console.error("清空安全存储失败:", error);
      throw new Error(
        `清空安全存储失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  // 获取存储统计信息
  async getStorageStats(): Promise<{
    totalItems: number;
    totalSize: number;
    lastAccessed: number;
  }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const keys = await this.getAllKeys();
      let totalSize = 0;

      for (const key of keys) {
        const filePath = this.getItemFilePath(key);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }

      const metadata = await this.getMetadata();

      return {
        totalItems: keys.length,
        totalSize,
        lastAccessed: metadata.lastAccessed,
      };
    } catch (error) {
      console.error("获取存储统计信息失败:", error);
      return { totalItems: 0, totalSize: 0, lastAccessed: 0 };
    }
  }

  // 私有方法：确保存储目录存在
  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch (error) {
      console.error("创建存储目录失败:", error);
      throw error;
    }
  }

  // 私有方法：获取项目文件路径
  private getItemFilePath(key: string): string {
    // 清理键名，确保文件名安全
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, "_");
    return path.join(this.storageDir, `${safeKey}.json`);
  }

  // 私有方法：初始化元数据
  private async initializeMetadata(): Promise<void> {
    try {
      const metadata: StorageMetadata = {
        version: "1.0.0",
        createdAt: Date.now(),
        lastAccessed: Date.now(),
      };

      await fs.writeFile(
        this.metadataFile,
        JSON.stringify(metadata, null, 2),
        "utf8",
      );
    } catch (error) {
      // 如果元数据文件已存在，则更新访问时间
      await this.updateMetadata();
    }
  }

  // 私有方法：更新元数据
  private async updateMetadata(): Promise<void> {
    try {
      const metadata = await this.getMetadata();
      metadata.lastAccessed = Date.now();

      await fs.writeFile(
        this.metadataFile,
        JSON.stringify(metadata, null, 2),
        "utf8",
      );
    } catch (error) {
      console.warn("更新元数据失败:", error);
    }
  }

  // 私有方法：获取元数据
  private async getMetadata(): Promise<StorageMetadata> {
    try {
      const fileContent = await fs.readFile(this.metadataFile, "utf8");
      return JSON.parse(fileContent);
    } catch {
      return {
        version: "1.0.0",
        createdAt: Date.now(),
        lastAccessed: Date.now(),
      };
    }
  }

  // 检查加密是否可用
  static isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }
}

// GitHub Token 专用存储服务
export class GitHubTokenStorage {
  private static readonly TOKEN_KEY = "github_access_token";
  private static readonly USER_KEY = "github_user_info";
  private static readonly AUTH_METHOD_KEY = "github_auth_method";
  private static readonly TOKEN_EXPIRY = 90 * 24 * 60 * 60 * 1000; // 90天

  private secureStorage: SecureStorageService;

  constructor() {
    this.secureStorage = SecureStorageService.getInstance();
  }

  // 保存 GitHub Token
  async saveToken(token: string, authMethod: "token"): Promise<void> {
    await this.secureStorage.setItem(
      GitHubTokenStorage.TOKEN_KEY,
      token,
      GitHubTokenStorage.TOKEN_EXPIRY,
    );
    await this.secureStorage.setItem(
      GitHubTokenStorage.AUTH_METHOD_KEY,
      authMethod,
    );
  }

  // 获取 GitHub Token
  async getToken(): Promise<string | null> {
    return await this.secureStorage.getItem(GitHubTokenStorage.TOKEN_KEY);
  }

  // 保存用户信息
  async saveUserInfo(userInfo: any): Promise<void> {
    await this.secureStorage.setItem(
      GitHubTokenStorage.USER_KEY,
      JSON.stringify(userInfo),
    );
  }

  // 获取用户信息
  async getUserInfo(): Promise<any | null> {
    const userInfoStr = await this.secureStorage.getItem(
      GitHubTokenStorage.USER_KEY,
    );
    return userInfoStr ? JSON.parse(userInfoStr) : null;
  }

  // 获取认证方式
  async getAuthMethod(): Promise<"token" | null> {
    return (await this.secureStorage.getItem(
      GitHubTokenStorage.AUTH_METHOD_KEY,
    )) as "token" | null;
  }

  // 检查是否有有效的认证
  async hasValidAuth(): Promise<boolean> {
    const token = await this.getToken();
    return token !== null;
  }

  // 清除所有认证信息
  async clearAuth(): Promise<void> {
    await this.secureStorage.removeItem(GitHubTokenStorage.TOKEN_KEY);
    await this.secureStorage.removeItem(GitHubTokenStorage.USER_KEY);
    await this.secureStorage.removeItem(GitHubTokenStorage.AUTH_METHOD_KEY);
  }
}

// 导出单例实例
export const secureStorageService = SecureStorageService.getInstance();
export const githubTokenStorage = new GitHubTokenStorage();
