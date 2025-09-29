/**
 * 渲染进程 API 服务层
 * 封装对 electronAPI 的调用，提供类型安全的接口
 * 重构后：仅处理 UI 层面的 API 调用，所有业务逻辑已迁移到 main 进程
 */

import type { ThemeMode, Language } from "@shared/types";

// GitHub 相关类型定义
export interface AuthMethodOption {
  id: "token";
  title: string;
  description: string;
  icon: string;
  recommended?: boolean;
}

// 重新导出共享类型
export type { AuthState, TokenValidationResult, GitHubUser, GitHubRepository } from "@shared/types";

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
 * 窗口控制 API
 */
export const windowAPI = {
  minimize: async (): Promise<void> => {
    ensureElectronAPI();
    const result = await window.electronAPI.window.minimize();
    if (!result.success) {
      throw new Error(result.error || "Failed to minimize window");
    }
  },

  maximize: async (): Promise<void> => {
    ensureElectronAPI();
    const result = await window.electronAPI.window.maximize();
    if (!result.success) {
      throw new Error(result.error || "Failed to maximize window");
    }
  },

  close: async (): Promise<void> => {
    ensureElectronAPI();
    const result = await window.electronAPI.window.close();
    if (!result.success) {
      throw new Error(result.error || "Failed to close window");
    }
  },

  toggleMaximize: async (): Promise<boolean> => {
    ensureElectronAPI();
    const result = await window.electronAPI.window.toggleMaximize();
    if (!result.success) {
      throw new Error(result.error || "Failed to toggle maximize");
    }
    return result.data?.isMaximized || false;
  },

  setFullscreen: async (fullscreen: boolean): Promise<boolean> => {
    ensureElectronAPI();
    const result = await window.electronAPI.window.setFullscreen(fullscreen);
    if (!result.success) {
      throw new Error(result.error || "Failed to set fullscreen");
    }
    return result.data?.isFullscreen || false;
  },
};

/**
 * 主题控制 API
 */
export const themeAPI = {
  getTheme: async (): Promise<ThemeMode> => {
    ensureElectronAPI();
    const result = await window.electronAPI.theme.getTheme();
    if (!result.success) {
      throw new Error(result.error || "Failed to get theme");
    }
    return result.data as ThemeMode;
  },

  setTheme: async (theme: ThemeMode): Promise<ThemeMode> => {
    ensureElectronAPI();
    const result = await window.electronAPI.theme.setTheme(theme);
    if (!result.success) {
      throw new Error(result.error || "Failed to set theme");
    }
    return result.data as ThemeMode;
  },

  toggleTheme: async (): Promise<ThemeMode> => {
    ensureElectronAPI();
    const result = await window.electronAPI.theme.toggleTheme();
    if (!result.success) {
      throw new Error(result.error || "Failed to toggle theme");
    }
    return result.data as ThemeMode;
  },

  onThemeChanged: (callback: (theme: ThemeMode) => void): (() => void) => {
    ensureElectronAPI();
    return window.electronAPI.theme.onThemeChanged(callback);
  },
};

/**
 * 语言控制 API
 */
export const languageAPI = {
  getLanguage: async (): Promise<Language> => {
    ensureElectronAPI();
    const result = await window.electronAPI.language.getLanguage();
    if (!result.success) {
      throw new Error(result.error || "Failed to get language");
    }
    return result.data as Language;
  },

  setLanguage: async (language: Language): Promise<Language> => {
    ensureElectronAPI();
    const result = await window.electronAPI.language.setLanguage(language);
    if (!result.success) {
      throw new Error(result.error || "Failed to set language");
    }
    return result.data as Language;
  },

  onLanguageChanged: (callback: (language: Language) => void): (() => void) => {
    ensureElectronAPI();
    return window.electronAPI.language.onLanguageChanged(callback);
  },
};

/**
 * GitHub API - 所有业务逻辑已迁移到 main 进程
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
    return result.data;
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
  getStarredRepositories: async (options: any = {}) => {
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

  getAllStarredRepositories: async (options: any = {}) => {
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

  searchStarredRepositories: async (query: string, options: any = {}) => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.searchStarredRepositories(query, options);
    if (!result.success) {
      throw new Error(result.error || "搜索收藏仓库失败");
    }
    return result.data;
  },

  // 向量数据库集成 - 新增功能
  initializeDatabase: async () => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.initializeDatabase();
    if (!result.success) {
      throw new Error(result.error || "数据库初始化失败");
    }
    return result.data;
  },

  getAllStarredRepositoriesEnhanced: async (options: any = {}) => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.getAllStarredRepositoriesEnhanced(options);
    if (!result.success) {
      throw new Error(result.error || "获取增强版收藏仓库失败");
    }
    return result.data;
  },

  searchRepositoriesSemanticially: async (query: string, limit?: number, filters?: any) => {
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

  syncRepositoriesToDatabase: async (repositories: any[]) => {
    ensureElectronAPI();
    const result = await window.electronAPI.github.syncRepositoriesToDatabase(repositories);
    if (!result.success) {
      throw new Error(result.error || "同步仓库到数据库失败");
    }
    return result.data;
  },
};

/**
 * 搜索 API - 基于 LanceDB 的全文检索和语义搜索
 */
export const searchAPI = {
  searchRepositories: async (options: {
    query?: string;
    language?: string;
    minStars?: number;
    maxStars?: number;
    limit?: number;
    sortBy?: 'relevance' | 'stars' | 'updated' | 'created';
    sortOrder?: 'asc' | 'desc';
  }) => {
    ensureElectronAPI();
    const result = await window.electronAPI.search.searchRepositories(options);
    if (!result.success) {
      throw new Error(result.error?.message || "搜索仓库失败");
    }
    return result.data;
  },

  getSearchSuggestions: async (input: string, limit?: number) => {
    ensureElectronAPI();
    const result = await window.electronAPI.search.getSearchSuggestions(input, limit);
    if (!result.success) {
      throw new Error(result.error?.message || "获取搜索建议失败");
    }
    return result.data;
  },

  getPopularSearchTerms: async (limit?: number) => {
    ensureElectronAPI();
    const result = await window.electronAPI.search.getPopularSearchTerms(limit);
    if (!result.success) {
      throw new Error(result.error?.message || "获取热门搜索词失败");
    }
    return result.data;
  },

  getSearchStats: async () => {
    ensureElectronAPI();
    const result = await window.electronAPI.search.getSearchStats();
    if (!result.success) {
      throw new Error(result.error?.message || "获取搜索统计失败");
    }
    return result.data;
  },
};

export const databaseAPI = {
  // TODO: 实现数据库 API - 业务逻辑将迁移到 main 进程
};

export const aiAPI = {
  // TODO: 实现 AI API - 业务逻辑将迁移到 main 进程
};
