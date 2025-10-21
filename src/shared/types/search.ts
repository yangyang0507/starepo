/**
 * 搜索相关类型定义
 * 包含搜索结果、搜索历史等
 */

/**
 * 搜索结果(泛型)
 */
export interface SearchResult<T = unknown> {
  items: T[];
  totalCount: number;
  query?: string;
  scores?: number[];
  page?: number;
  pageSize?: number;
  offset?: number;
  hasMore?: boolean;
  nextOffset?: number;
  cached?: boolean;
}

/**
 * 搜索历史项
 */
export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  resultsCount: number;
}
