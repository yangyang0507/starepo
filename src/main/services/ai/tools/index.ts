/**
 * AI 工具系统
 * 使用 AI SDK v5 的 tool 格式直接定义所有工具
 */

import { LanceDBSearchService } from '@main/services/search/lancedb-search-service';
import {
  searchRepositoriesTool,
  initializeSearchRepositoriesTool,
} from './search-repositories';
import {
  filterRepositoriesTool,
  initializeFilterRepositoriesTool,
} from './filter-repositories';
import {
  getPopularRepositoriesTool,
  initializeGetPopularRepositoriesTool,
} from './get-popular-repositories';
import {
  getRepositoryDetailsTool,
  initializeGetRepositoryDetailsTool,
} from './get-repository-details';
import {
  getRepositoriesByTopicTool,
  initializeGetRepositoriesByTopicTool,
} from './get-repositories-by-topic';

/**
 * 初始化所有工具
 */
export async function initializeTools(searchService: LanceDBSearchService): Promise<void> {
  await searchService.initialize();

  initializeSearchRepositoriesTool(searchService);
  initializeFilterRepositoriesTool(searchService);
  initializeGetPopularRepositoriesTool(searchService);
  initializeGetRepositoryDetailsTool(searchService);
  initializeGetRepositoriesByTopicTool(searchService);
}

/**
 * 导出所有工具
 */
export const tools = {
  search_repositories: searchRepositoriesTool,
  filter_repositories: filterRepositoriesTool,
  get_popular_repositories: getPopularRepositoriesTool,
  get_repository_details: getRepositoryDetailsTool,
  get_repositories_by_topic: getRepositoriesByTopicTool,
};
