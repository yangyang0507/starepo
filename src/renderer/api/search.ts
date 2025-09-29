/**
 * 搜索相关 API
 * 基于 LanceDB 的全文检索和语义搜索
 */

import type { APIResponse } from '@shared/types';

// 搜索选项接口
export interface SearchOptions {
  query?: string;
  language?: string;
  minStars?: number;
  maxStars?: number;
  limit?: number;
  sortBy?: 'relevance' | 'stars' | 'updated' | 'created';
  sortOrder?: 'asc' | 'desc';
}

// 搜索结果接口
export interface SearchResult {
  repositories: any[];
  totalCount: number;
  searchTime: number;
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
 * 搜索仓库
 */
export async function searchRepositories(options: SearchOptions): Promise<SearchResult> {
  const response: APIResponse<SearchResult> = await window.electronAPI.search.searchRepositories(options);

  if (!response.success) {
    throw new Error(response.error?.message || '搜索失败');
  }

  return response.data!;
}

/**
 * 获取搜索建议
 */
export async function getSearchSuggestions(input: string, limit: number = 10): Promise<SearchSuggestions> {
  const response: APIResponse<SearchSuggestions> = await window.electronAPI.search.getSearchSuggestions(input, limit);

  if (!response.success) {
    throw new Error(response.error?.message || '获取搜索建议失败');
  }

  return response.data!;
}

/**
 * 获取热门搜索词
 */
export async function getPopularSearchTerms(limit: number = 10): Promise<PopularTerms> {
  const response: APIResponse<PopularTerms> = await window.electronAPI.search.getPopularSearchTerms(limit);

  if (!response.success) {
    throw new Error(response.error?.message || '获取热门搜索词失败');
  }

  return response.data!;
}

/**
 * 获取搜索统计
 */
export async function getSearchStats(): Promise<SearchStats> {
  const response: APIResponse<SearchStats> = await window.electronAPI.search.getSearchStats();

  if (!response.success) {
    throw new Error(response.error?.message || '获取搜索统计失败');
  }

  return response.data!;
}

/**
 * 简化的搜索函数 - 只需要查询文本
 */
export async function quickSearch(query: string, limit: number = 20): Promise<any[]> {
  const result = await searchRepositories({
    query,
    limit,
    sortBy: 'relevance',
    sortOrder: 'desc'
  });

  return result.repositories;
}

/**
 * 按语言搜索
 */
export async function searchByLanguage(language: string, limit: number = 20): Promise<any[]> {
  const result = await searchRepositories({
    language,
    limit,
    sortBy: 'stars',
    sortOrder: 'desc'
  });

  return result.repositories;
}

/**
 * 按 star 数量范围搜索
 */
export async function searchByStarRange(minStars: number, maxStars: number, limit: number = 20): Promise<any[]> {
  const result = await searchRepositories({
    minStars,
    maxStars,
    limit,
    sortBy: 'stars',
    sortOrder: 'desc'
  });

  return result.repositories;
}

/**
 * 高级搜索 - 组合多个条件
 */
export async function advancedSearch(options: {
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
}> {
  return await searchRepositories({
    limit: 50,
    sortBy: 'relevance',
    sortOrder: 'desc',
    ...options
  });
}