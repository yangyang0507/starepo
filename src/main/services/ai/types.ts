/**
 * AI 服务相关类型定义
 * 包含向量搜索和嵌入服务的配置类型
 */

import type { AIProvider, RepositoryReference, ChatContext } from '@shared/types';

// ============ 向量搜索服务类型 =============

export interface VectorSearchConfig {
  topK?: number;
  scoreThreshold?: number;
}

// ============ 嵌入服务类型 =============

export interface EmbeddingServiceConfig {
  apiKey: string;
  provider: AIProvider;
  model: string;
  cacheSize?: number;
}

// ============ 服务状态类型 =============

export interface AIServiceStatus {
  isInitialized: boolean;
  provider?: AIProvider;
  model?: string;
  lastError?: string;
}

// ============ 搜索结果增强类型 =============

export interface EnhancedRepositoryReference extends RepositoryReference {
  relevanceScore: number;
  matchType: 'vector' | 'fulltext' | 'hybrid';
  position?: number;
}

// ============ 缓存统计类型 =============

export interface EmbeddingCacheStats {
  size: number;
  items: number;
  hitRate?: number;
  memoryUsage?: number;
}

// ============ 搜索性能指标 =============

export interface SearchPerformanceMetrics {
  vectorSearchTime: number;
  fullTextSearchTime: number;
  mergeTime: number;
  totalTime: number;
  resultCount: number;
}

// ============ 服务配置验证类型 =============

export interface ServiceConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============ 对话上下文增强 =============

export interface EnhancedChatContext extends ChatContext {
  searchMetrics?: SearchPerformanceMetrics;
  cacheStats?: EmbeddingCacheStats;
  serviceStatus?: AIServiceStatus;
}
