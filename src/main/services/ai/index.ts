/**
 * AI 服务模块导出
 */

import { AIService } from "./ai-service";

// 导出 AI 服务（基于 AI SDK V5）
export { AIService } from "./ai-service";

// 导出新架构组件
export { globalProviderRegistry } from "./registry-init";
export { ProviderFactory } from "./providers/factory";
export { ModelResolver } from "./core/models";
export { MiddlewareChain } from "./core/middleware";
export {
  LoggingMiddleware,
  RetryMiddleware,
  RateLimitMiddleware,
} from "./core/middleware/built-in";
export { ModelCacheService } from "./storage/model-cache-service";
export { globalConnectionManager } from "./core/runtime/connection-manager";

// 导出工具系统
export { initializeTools, tools } from "./tools";

// 导出模型发现服务
export { modelDiscoveryService } from "./discovery/model-discovery-service";

// 导出 Provider 账户服务
export {
  providerAccountService,
  ProviderAccountService,
} from "./storage/provider-account-service";

// AI 服务单例
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
