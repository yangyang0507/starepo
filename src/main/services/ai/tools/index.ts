/**
 * AI 工具系统导出
 * 统一导出所有工具和工具注册中心
 */

export * from './types';
export * from './tool-registry';
export * from './search-repositories-tool';
export * from './filter-repositories-tool';
export * from './get-repository-details-tool';
export * from './get-popular-repositories-tool';
export * from './get-repositories-by-topic-tool';

import { toolRegistry } from './tool-registry';
import { SearchRepositoriesTool } from './search-repositories-tool';
import { FilterRepositoriesTool } from './filter-repositories-tool';
import { GetRepositoryDetailsTool } from './get-repository-details-tool';
import { GetPopularRepositoriesTool } from './get-popular-repositories-tool';
import { GetRepositoriesByTopicTool } from './get-repositories-by-topic-tool';
import { LanceDBSearchService } from '@main/services/search/lancedb-search-service';

/**
 * 初始化并注册所有工具
 */
export async function initializeTools(searchService: LanceDBSearchService): Promise<void> {
  // 确保搜索服务已初始化
  await searchService.initialize();

  // 注册所有工具
  toolRegistry.register(new SearchRepositoriesTool(searchService));
  toolRegistry.register(new FilterRepositoriesTool(searchService));
  toolRegistry.register(new GetRepositoryDetailsTool(searchService));
  toolRegistry.register(new GetPopularRepositoriesTool(searchService));
  toolRegistry.register(new GetRepositoriesByTopicTool(searchService));
}

/**
 * 获取全局工具注册中心
 */
export function getToolRegistry() {
  return toolRegistry;
}
