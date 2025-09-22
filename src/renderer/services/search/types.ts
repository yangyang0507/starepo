/**
 * 搜索引擎核心类型定义
 * 支持关键词搜索，为未来向量搜索和对话搜索预留接口
 */

import type { GitHubRepository } from '@/services/github/types';

// ============ 基础搜索类型 =============

export type SearchType = 'keyword' | 'semantic' | 'conversational' | 'hybrid';

export interface SearchQuery {
  text: string;
  type: SearchType;
  options?: SearchOptions;
  context?: SearchContext;
  weights?: SearchWeights;
}

export interface SearchOptions {
  // 基础选项
  limit?: number;
  offset?: number;
  fuzzy?: boolean;
  caseSensitive?: boolean;
  wholeWord?: boolean;

  // 字段权重
  fieldWeights?: FieldWeights;

  // 筛选条件
  filters?: SearchFilters;

  // 排序选项
  sortBy?: SortField;
  sortOrder?: 'asc' | 'desc';
}

export interface FieldWeights {
  name: number;
  description: number;
  topics: number;
  owner: number;
  readme?: number; // 未来扩展
}

export interface SearchFilters {
  language?: string;
  topic?: string;
  minStars?: number;
  maxStars?: number;
  showArchived?: boolean;
  showForks?: boolean;
  dateRange?: {
    field: 'created' | 'updated';
    start?: Date;
    end?: Date;
  };
}

export type SortField = 'relevance' | 'name' | 'stars' | 'updated' | 'created';

// ============ 搜索上下文 =============

export interface SearchContext {
  conversationId?: string;
  previousQueries?: string[];
  userPreferences?: UserPreferences;
  sessionContext?: SessionContext;
}

export interface UserPreferences {
  preferredLanguages?: string[];
  preferredTopics?: string[];
  searchHistory?: SearchHistoryItem[];
}

export interface SessionContext {
  currentPage?: string;
  selectedRepositories?: string[];
  recentActions?: UserAction[];
}

export interface UserAction {
  type: 'star' | 'unstar' | 'view' | 'search';
  repositoryId?: string;
  query?: string;
  timestamp: Date;
}

// ============ 搜索权重 =============

export interface SearchWeights {
  keyword: number;    // 关键词搜索权重 (0-1)
  semantic: number;   // 语义搜索权重 (0-1) - 未来使用
  popularity: number; // 流行度权重 (0-1)
  recency: number;    // 时效性权重 (0-1)
}

// ============ 搜索结果 =============

export interface SearchResult {
  repository: GitHubRepository;
  score: number;
  type: SearchType;
  matches: SearchMatch[];
  explanation?: string;
  metadata: SearchResultMetadata;
}

export interface SearchMatch {
  field: string;
  value: string;
  highlights: TextHighlight[];
  score: number;
}

export interface TextHighlight {
  start: number;
  end: number;
  text: string;
  type: 'exact' | 'fuzzy' | 'semantic';
}

export interface SearchResultMetadata {
  matchedFields: string[];
  relevanceFactors: RelevanceFactor[];
  searchTime: number;
  confidence: number;
}

export interface RelevanceFactor {
  factor: string;
  weight: number;
  contribution: number;
  description: string;
}

// ============ 搜索统计与分析 =============

// 用于单次搜索性能的统计
export interface SearchPerformanceStats {
  totalResults: number;
  searchTime: number;
  indexSize: number;
  cacheHitRate?: number;
}

// 用于历史行为分析的统计
export interface SearchAnalyticsStats {
  totalSearches: number;
  popularTerms: Record<string, number>;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  type: SearchType;
  timestamp: Date;
  resultCount: number;
  executionTime: number;
  filters?: SearchFilters;
  error?: string;
}

// ============ 搜索建议 =============

export interface SearchSuggestion {
  text: string;
  type: 'history' | 'popular' | 'completion' | 'correction';
  frequency?: number;
  lastUsed?: Date;
  score: number;
}

// ============ 搜索索引 =============

export interface SearchIndex {
  documents: Map<string, IndexedDocument>;
  invertedIndex: Map<string, PostingList>;
  fieldIndex: Map<string, Map<string, PostingList>>;
  metadata: IndexMetadata;
}

export interface IndexedDocument {
  id: string;
  fields: Map<string, string>;
  tokens: Token[];
  metadata: DocumentMetadata;
  lastUpdated: Date;
}

export interface DocumentMetadata {
  repository: GitHubRepository;
  searchableText: string;
  fieldLengths: Map<string, number>;
  termFrequencies: Map<string, number>;
}

export interface PostingList {
  term: string;
  documentFrequency: number;
  postings: DocumentPosting[];
}

export interface DocumentPosting {
  documentId: string;
  termFrequency: number;
  positions: number[];
  fieldBoosts: Map<string, number>;
}

export interface Token {
  text: string;
  normalized: string;
  position: number;
  field: string;
  type: TokenType;
}

export type TokenType = 'word' | 'number' | 'symbol' | 'whitespace';

export interface IndexMetadata {
  totalDocuments: number;
  totalTerms: number;
  averageDocumentLength: number;
  fieldStatistics: Map<string, FieldStatistics>;
  createdAt: Date;
  lastUpdated: Date;
}

export interface FieldStatistics {
  totalLength: number;
  averageLength: number;
  uniqueTerms: number;
  maxTermFrequency: number;
}

// ============ 查询解析 =============

export interface ParsedQuery {
  originalQuery: string;
  clauses: QueryClause[];
  filters: SearchFilters;
  options: SearchOptions;
}

export interface QueryClause {
  type: 'term' | 'phrase' | 'field' | 'range' | 'wildcard' | 'fuzzy';
  field?: string;
  value: string;
  operator?: 'AND' | 'OR' | 'NOT';
  boost?: number;
  fuzzyDistance?: number;
}

// ============ 搜索引擎接口 =============

export interface ISearchEngine {
  search(query: SearchQuery): Promise<SearchResult[]>;
  suggest(input: string, limit?: number): Promise<SearchSuggestion[]>;
  buildIndex(repositories: GitHubRepository[]): Promise<void>;
  updateIndex(repository: GitHubRepository): Promise<void>;
  removeFromIndex(repositoryId: string): Promise<void>;
  getStats(): Promise<SearchPerformanceStats>;
  explain(query: SearchQuery): Promise<SearchExplanation>;
}

export interface SearchExplanation {
  query: ParsedQuery;
  strategy: string;
  steps: ExplanationStep[];
  totalTime: number;
}

export interface ExplanationStep {
  step: string;
  description: string;
  time: number;
  results?: number;
  details?: Record<string, unknown>;
}

// ============ 错误类型 =============

export class SearchError extends Error {
  constructor(
    message: string,
    public code: SearchErrorCode,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SearchError';
  }
}

export enum SearchErrorCode {
  INVALID_QUERY = 'INVALID_QUERY',
  INDEX_NOT_READY = 'INDEX_NOT_READY',
  SEARCH_TIMEOUT = 'SEARCH_TIMEOUT',
  INVALID_SYNTAX = 'INVALID_SYNTAX',
  FIELD_NOT_FOUND = 'FIELD_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

// ============ 配置类型 =============

export interface SearchEngineConfig {
  // 索引配置
  indexing: {
    batchSize: number;
    maxDocuments: number;
    fieldWeights: FieldWeights;
  };

  // 搜索配置
  search: {
    defaultLimit: number;
    maxLimit: number;
    timeout: number;
    fuzzyThreshold: number;
  };

  // 缓存配置
  cache: {
    enabled: boolean;
    maxSize: number;
    ttl: number;
  };

  // 性能配置
  performance: {
    enableParallelSearch: boolean;
    indexUpdateThrottle: number;
    searchThrottle: number;
  };
}