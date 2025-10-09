/**
 * 搜索相关 API
 * 基于 LanceDB 的全文检索和语义搜索
 */

import type { APIResponse } from '@shared/types';

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

// 搜索选项接口
export interface SearchOptions {
  query?: string;
  language?: string;
  minStars?: number;
  maxStars?: number;
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  sortBy?: 'relevance' | 'stars' | 'updated' | 'created';
  sortOrder?: 'asc' | 'desc';
  disableCache?: boolean;
}

// 搜索结果接口
export interface SearchResult {
  repositories: any[];
  totalCount: number;
  searchTime: number;
  page: number;
  pageSize: number;
  offset: number;
  hasMore: boolean;
  nextOffset?: number;
  cached?: boolean;
}

// 搜索建议接口
export interface SearchSuggestions {
  terms: string[];
  languages: string[];
  topics: string[];
}

// 热门搜索词接口
export interface PopularTerms {
  languages: Array<{ name: string; count: number }>;
  topics: Array<{ name: string; count: number }>;
}

// 搜索统计接口
export interface SearchStats {
  totalRepositories: number;
  totalUsers: number;
  indexSize: number;
}

/**
 * 搜索 API
 */
export const searchAPI = {
  /**
   * 搜索仓库
   */
  searchRepositories: async (options: SearchOptions): Promise<SearchResult> => {
    ensureElectronAPI();
    const response: APIResponse<SearchResult> = await window.electronAPI.search.searchRepositories(options);

    if (!response.success) {
      throw new Error(response.error || '搜索失败');
    }

    return response.data!;
  },

  /**
   * 获取搜索建议
   */
  getSearchSuggestions: async (input: string, limit: number = 10): Promise<SearchSuggestions> => {
    ensureElectronAPI();
    const response: APIResponse<SearchSuggestions> = await window.electronAPI.search.getSearchSuggestions(input, limit);

    if (!response.success) {
      throw new Error(response.error || '获取搜索建议失败');
    }

    return response.data!;
  },

  /**
   * 获取热门搜索词
   */
  getPopularSearchTerms: async (limit: number = 10): Promise<PopularTerms> => {
    ensureElectronAPI();
    const response: APIResponse<PopularTerms> = await window.electronAPI.search.getPopularSearchTerms(limit);

    if (!response.success) {
      throw new Error(response.error || '获取热门搜索词失败');
    }

    return response.data!;
  },

  /**
   * 获取搜索统计
   */
  getSearchStats: async (): Promise<SearchStats> => {
    ensureElectronAPI();
    const response: APIResponse<SearchStats> = await window.electronAPI.search.getSearchStats();

    if (!response.success) {
      throw new Error(response.error || '获取搜索统计失败');
    }

    return response.data!;
  },

  /**
   * 简化的搜索函数 - 只需要查询文本
   */
  quickSearch: async (query: string, limit: number = 20): Promise<any[]> => {
    const result = await searchAPI.searchRepositories({
      query,
      limit,
      sortBy: 'relevance',
      sortOrder: 'desc'
    });

    return result.repositories;
  },

  /**
   * 按语言搜索
   */
  searchByLanguage: async (language: string, limit: number = 20): Promise<any[]> => {
    const result = await searchAPI.searchRepositories({
      language,
      limit,
      sortBy: 'stars',
      sortOrder: 'desc'
    });

    return result.repositories;
  },

  /**
   * 按 star 数量范围搜索
   */
  searchByStarRange: async (minStars: number, maxStars: number, limit: number = 20): Promise<any[]> => {
    const result = await searchAPI.searchRepositories({
      minStars,
      maxStars,
      limit,
      sortBy: 'stars',
      sortOrder: 'desc'
    });

    return result.repositories;
  },

  /**
   * 高级搜索 - 组合多个条件
   */
  advancedSearch: async (options: {
    query?: string;
    language?: string;
    minStars?: number;
    maxStars?: number;
    sortBy?: 'relevance' | 'stars' | 'updated' | 'created';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
  }): Promise<{
    repositories: any[];
    totalCount: number;
    searchTime: number;
  }> => {
    return await searchAPI.searchRepositories({
      limit: 50,
      sortBy: 'relevance',
      sortOrder: 'desc',
      ...options
    });
  },
};
