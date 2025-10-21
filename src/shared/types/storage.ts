/**
 * 存储相关类型定义
 * 包含安全存储和本地数据持久化
 */

/**
 * 安全存储项
 */
export interface SecureStorageItem {
  key: string;
  value: string;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

/**
 * 存储元数据
 */
export interface StorageMetadata {
  version: string;
  createdAt: number;
  lastAccessed: number;
}
