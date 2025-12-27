/**
 * AI 服务模块导出
 */

import { AIService } from "./ai-service";

// 导出 AI 服务（基于 AI SDK V5）
export { AIService } from "./ai-service";

// 导出工具系统
export { initializeTools, tools } from "./tools";

// 导出模型发现服务
export { modelDiscoveryService } from "./model-discovery-service";

// 导出 AI 设置持久化服务
export { aiSettingsService } from "./ai-settings-service";

// 导出 Provider 适配器系统
export * from "./adapters";

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
