/**
 * 获取热门仓库工具
 * 获取最受欢迎的仓库（按星数排序）
 */

import { LanceDBSearchService } from '@main/services/search/lancedb-search-service';
import { logger } from '@main/utils/logger';
import type { ITool, ToolDefinition, GetPopularRepositoriesParams, RepositorySearchResult } from './types';

export class GetPopularRepositoriesTool implements ITool {
  private searchService: LanceDBSearchService;

  constructor(searchService: LanceDBSearchService) {
    this.searchService = searchService;
  }

  readonly definition: ToolDefinition = {
    name: 'get_popular_repositories',
    description: '获取最受欢迎的 GitHub 仓库（按星数排序）。可选择性地按编程语言筛选。适用于用户想要查看热门项目或某个语言的热门项目。',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: '返回结果数量限制，默认 10，最大 50',
        },
        language: {
          type: 'string',
          description: '可选：按编程语言筛选，例如：JavaScript, Python, Go 等',
        },
      },
    },
  };

  async execute(params: Record<string, unknown>): Promise<RepositorySearchResult> {
    const { limit = 10, language } = params as GetPopularRepositoriesParams;

    logger.debug('Getting popular repositories', { limit, language });

    try {
      const searchOptions: Record<string, unknown> = {
        limit: Math.min(limit, 50),
        sortBy: 'stars',
        sortOrder: 'desc',
      };

      if (language) {
        searchOptions.language = language;
      }

      const result = await this.searchService.searchRepositories(searchOptions);

      return {
        repositories: result.repositories,
        totalCount: result.totalCount,
        hasMore: result.hasMore,
      };
    } catch (error) {
      logger.error('Get popular repositories tool failed:', error);
      throw new Error(`获取热门仓库失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
