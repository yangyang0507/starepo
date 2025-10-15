/**
 * GitHub API
 * 封装GitHub相关功能（包含认证和仓库管理）
 */

import type { 
  GitHubRepository, 
  GitHubPaginationOptions, 
  GitHubSearchOptions 
} from "@shared/types";
import { deserializeDates } from "@/utils/serialization";

/**
 * 检查 electronAPI 是否可用
 */
function ensureElectronAPI(): void {
  if (!window.electronAPI) {
    throw new Error(
      "ElectronAPI is not available. Make sure preload script is loaded.",
    );
  }
}

/**
 * GitHub API - 完整的认证和仓库管理功能
 */
export const githubAPI = {
  // 认证相关
  authenticateWithToken: async (token: string) => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.authenticateWithToken(token);
    if (!result.success) {
      throw new Error(result.error || "认证失败");
    }
    return result.data;
  },

  validateToken: async (token: string) => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.validateToken(token);
    if (!result.success) {
      throw new Error(result.error || "Token 验证失败");
    }
    return result.data;
  },

  getAuthState: async () => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.getAuthState();
    if (!result.success) {
      throw new Error(result.error || "获取认证状态失败");
    }
    
    // 使用通用反序列化函数处理所有Date字段
    const authState = deserializeDates(result.data) as AuthState;
    
    return authState;
  },

  refreshAuth: async () => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.refreshAuth();
    if (!result.success) {
      throw new Error(result.error || "刷新认证失败");
    }
    return result.data;
  },

  clearAuth: async () => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.clearAuth();
    if (!result.success) {
      throw new Error(result.error || "清除认证失败");
    }
  },

  // 用户相关
  getCurrentUser: async () => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.getCurrentUser();
    if (!result.success) {
      throw new Error(result.error || "获取用户信息失败");
    }
    return result.data;
  },

  // Star 相关
  getStarredRepositories: async (options: GitHubPaginationOptions = {}) => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.getStarredRepositories(options);
    if (!result.success) {
      throw new Error(result.error || "获取收藏仓库失败");
    }
    return result.data;
  },

  checkIfStarred: async (owner: string, repo: string) => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.checkIfStarred(owner, repo);
    if (!result.success) {
      throw new Error(result.error || "检查收藏状态失败");
    }
    return result.data;
  },

  starRepository: async (owner: string, repo: string) => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.starRepository(owner, repo);
    if (!result.success) {
      throw new Error(result.error || "收藏仓库失败");
    }
  },

  unstarRepository: async (owner: string, repo: string) => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.unstarRepository(owner, repo);
    if (!result.success) {
      throw new Error(result.error || "取消收藏失败");
    }
  },

  getAllStarredRepositories: async (options: GitHubPaginationOptions = {}) => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.getAllStarredRepositories(options);
    if (!result.success) {
      throw new Error(result.error || "获取所有收藏仓库失败");
    }
    return result.data;
  },

  getStarredStats: async () => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.getStarredStats();
    if (!result.success) {
      throw new Error(result.error || "获取统计信息失败");
    }
    return result.data;
  },

  searchStarredRepositories: async (query: string, options: GitHubSearchOptions = {}) => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.searchStarredRepositories(query, options);
    if (!result.success) {
      throw new Error(result.error || "搜索收藏仓库失败");
    }
    return result.data;
  },

  // 向量数据库集成功能
  initializeDatabase: async () => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.initializeDatabase();
    if (!result.success) {
      throw new Error(result.error || "数据库初始化失败");
    }
    return result.data;
  },

  getAllStarredRepositoriesEnhanced: async (options: GitHubPaginationOptions = {}) => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.getAllStarredRepositoriesEnhanced(options);
    if (!result.success) {
      throw new Error(result.error || "获取增强版收藏仓库失败");
    }
    return result.data;
  },

  searchRepositoriesSemanticially: async (query: string, limit?: number, filters?: { language?: string; topics?: string[]; minStars?: number; maxStars?: number }) => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.searchRepositoriesSemanticially(query, limit, filters);
    if (!result.success) {
      throw new Error(result.error || "语义搜索仓库失败");
    }
    return result.data;
  },

  getRepositoriesByLanguageFromDatabase: async (language: string, limit?: number) => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.getRepositoriesByLanguageFromDatabase(language, limit);
    if (!result.success) {
      throw new Error(result.error || "从数据库按语言获取仓库失败");
    }
    return result.data;
  },

  getRepositoriesByStarRangeFromDatabase: async (minStars: number, maxStars: number, limit?: number) => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.getRepositoriesByStarRangeFromDatabase(minStars, maxStars, limit);
    if (!result.success) {
      throw new Error(result.error || "从数据库按 Star 范围获取仓库失败");
    }
    return result.data;
  },

  getDatabaseStats: async () => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.getDatabaseStats();
    if (!result.success) {
      throw new Error(result.error || "获取数据库统计信息失败");
    }
    return result.data;
  },

  syncRepositoriesToDatabase: async (repositories: GitHubRepository[]) => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.syncRepositoriesToDatabase(repositories);
    if (!result.success) {
      throw new Error(result.error || "同步仓库到数据库失败");
    }
    return result.data;
  },
};