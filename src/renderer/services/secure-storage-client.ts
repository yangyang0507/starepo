// 使用 preload 脚本暴露的 API

// IPC 响应类型
interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 存储统计信息
interface StorageStats {
  totalKeys: number;
  totalSize: number;
  lastAccessed: Date | null;
  lastModified: Date | null;
}

import type { GitHubUser } from "./github/types";

/**
 * 安全存储客户端类
 * 提供渲染进程与主进程安全存储服务的通信接口
 */
export class SecureStorageClient {
  /**
   * 检查加密是否可用
   */
  async isEncryptionAvailable(): Promise<boolean> {
    try {
      const response: IPCResponse<boolean> =
        await window.electronAPI.secureStorage.isEncryptionAvailable();

      if (!response.success) {
        console.warn("检查加密可用性失败:", response.error);
        return false;
      }

      return response.data ?? false;
    } catch (error) {
      console.error("检查加密可用性时发生错误:", error);
      return false;
    }
  }

  /**
   * 设置存储项目
   */
  async setItem(key: string, value: string, expiresIn?: number): Promise<void> {
    const response: IPCResponse =
      await window.electronAPI.secureStorage.setItem(key, value, expiresIn);

    if (!response.success) {
      throw new Error(response.error || "设置存储项目失败");
    }
  }

  /**
   * 获取存储项目
   */
  async getItem(key: string): Promise<string | null> {
    const response: IPCResponse<string | null> =
      await window.electronAPI.secureStorage.getItem(key);

    if (!response.success) {
      throw new Error(response.error || "获取存储项目失败");
    }

    return response.data ?? null;
  }

  /**
   * 删除存储项目
   */
  async removeItem(key: string): Promise<void> {
    const response: IPCResponse =
      await window.electronAPI.secureStorage.removeItem(key);

    if (!response.success) {
      throw new Error(response.error || "删除存储项目失败");
    }
  }

  /**
   * 检查存储项目是否存在
   */
  async hasItem(key: string): Promise<boolean> {
    const response: IPCResponse<boolean> =
      await window.electronAPI.secureStorage.hasItem(key);

    if (!response.success) {
      throw new Error(response.error || "检查存储项目失败");
    }

    return response.data ?? false;
  }

  /**
   * 获取所有存储键
   */
  async getAllKeys(): Promise<string[]> {
    const response: IPCResponse<string[]> =
      await window.electronAPI.secureStorage.getAllKeys();

    if (!response.success) {
      throw new Error(response.error || "获取存储键失败");
    }

    return response.data ?? [];
  }

  /**
   * 清空所有存储
   */
  async clear(): Promise<void> {
    const response: IPCResponse =
      await window.electronAPI.secureStorage.clearAll();

    if (!response.success) {
      throw new Error(response.error || "清空存储失败");
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<StorageStats> {
    const response: IPCResponse<StorageStats> =
      await window.electronAPI.secureStorage.getStats();

    if (!response.success) {
      throw new Error(response.error || "获取存储统计失败");
    }

    return response.data!;
  }
}

/**
 * GitHub Token 存储客户端类
 * 专门用于管理 GitHub 相关的认证信息
 */
export class GitHubTokenStorageClient {
  /**
   * 保存 GitHub Token
   */
  async saveToken(token: string, authMethod: "token"): Promise<void> {
    const response: IPCResponse =
      await window.electronAPI.secureStorage.saveGitHubToken(token, authMethod);

    if (!response.success) {
      throw new Error(response.error || "保存 GitHub Token 失败");
    }
  }

  /**
   * 获取 GitHub Token
   */
  async getToken(): Promise<string | null> {
    const response: IPCResponse<string | null> =
      await window.electronAPI.secureStorage.getGitHubToken();

    if (!response.success) {
      throw new Error(response.error || "获取 GitHub Token 失败");
    }

    return response.data ?? null;
  }

  /**
   * 保存用户信息
   */
  async saveUserInfo(userInfo: GitHubUser): Promise<void> {
    const response: IPCResponse =
      await window.electronAPI.secureStorage.saveUserInfo(userInfo);

    if (!response.success) {
      throw new Error(response.error || "保存用户信息失败");
    }
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(): Promise<GitHubUser | null> {
    const response: IPCResponse<GitHubUser | null> =
      await window.electronAPI.secureStorage.getUserInfo();

    if (!response.success) {
      throw new Error(response.error || "获取用户信息失败");
    }

    return response.data ?? null;
  }

  /**
   * 获取认证方式
   */
  async getAuthMethod(): Promise<"token" | null> {
    const response: IPCResponse<"token" | null> =
      await window.electronAPI.secureStorage.getAuthMethod();

    if (!response.success) {
      throw new Error(response.error || "获取认证方式失败");
    }

    return response.data ?? null;
  }

  /**
   * 检查是否有有效的认证信息
   */
  async hasValidAuth(): Promise<boolean> {
    const response: IPCResponse<boolean> =
      await window.electronAPI.secureStorage.hasValidAuth();

    if (!response.success) {
      throw new Error(response.error || "检查认证状态失败");
    }

    return response.data ?? false;
  }

  /**
   * 清除所有认证信息
   */
  async clearAuth(): Promise<void> {
    const response: IPCResponse =
      await window.electronAPI.secureStorage.clearAuth();

    if (!response.success) {
      throw new Error(response.error || "清除认证信息失败");
    }
  }
}

// 导出单例实例
export const secureStorageClient = new SecureStorageClient();
export const githubTokenStorageClient = new GitHubTokenStorageClient();

// 默认导出
export default {
  secureStorageClient,
  githubTokenStorageClient,
  SecureStorageClient,
  GitHubTokenStorageClient,
};
