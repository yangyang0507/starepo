import type { SearchResult as SharedSearchResult } from '@shared/types';

// 数据库相关类型定义

export interface LanceDBMetadata {
  [key: string]: string | number | boolean | null;
}

export interface SearchResult<T> extends SharedSearchResult<T> {
  scores: number[];
}

export interface DatabaseStats {
  repositoriesCount: number;
  usersCount: number;
  tablesCount: number;
}

export interface LanceDBQueryOptions {
  limit?: number;
  offset?: number;
  where?: string;
  includeFields?: string[];
}
