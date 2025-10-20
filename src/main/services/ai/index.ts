/**
 * AI 服务模块导出
 */

import { AIService } from "./ai-service";

export { AIService } from "./ai-service";
export { EmbeddingService } from "./embedding-service";
export { VectorSearchService } from "./vector-search-service";

// 导出类型定义
export type {
  VectorSearchConfig,
  EmbeddingServiceConfig,
  AIServiceStatus,
  EnhancedRepositoryReference,
  EmbeddingCacheStats,
  SearchPerformanceMetrics,
  ServiceConfigValidation,
  EnhancedChatContext,
} from "./types";

// 为了方便使用，可以创建一个单例
let aiServiceInstance: AIService | null = null;

export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
  }
  return aiServiceInstance!;
}

export function setAIService(service: AIService | null): void {
  aiServiceInstance = service;
}
