/**
 * 搜索仓库工具
 * 支持关键词搜索仓库（名称、描述、主题）
 */

import { LanceDBSearchService } from '@main/services/search/lancedb-search-service';
import { logger } from '@main/utils/logger';
import type { ITool, ToolDefinition, SearchRepositoriesParams, RepositorySearchResult } from './types';

export class SearchRepositoriesTool implements ITool {
  private searchService: LanceDBSearchService;

  constructor(searchService: LanceDBSearchService) {
    this.searchService = searchService;
  }

  readonly definition: ToolDefinition = {
    name: 'search_repositories',
    description: '搜索 GitHub 仓库，支持关键词匹配（仓库名称、描述、主题标签）。适用于用户想要查找特定关键词相关的仓库。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词，将在仓库名称、描述和主题中进行匹配',
        },
        limit: {
          type: 'number',
          description: '返回结果数量限制，默认 10，最大 50',
        },
        sortBy: {
          type: 'string',
          description: '排序字段',
          enum: ['relevance', 'stars', 'updated', 'created'],
        },
        sortOrder: {
          type: 'string',
          description: '排序顺序',
          enum: ['asc', 'desc'],
        },
      },
      required: ['query'],
    },
  };

  async execute(params: Record<string, unknown>): Promise<RepositorySearchResult> {
    const { query, limit = 10, sortBy = 'relevance', sortOrder = 'desc' } = params as SearchRepositoriesParams;

    logger.debug(`Searching repositories with query: "${query}"`);

    try {
      const result = await this.searchService.searchRepositories({
        query,
        limit: Math.min(limit, 50),
        sortBy: sortBy as 'relevance' | 'stars' | 'updated' | 'created',
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      return {
        repositories: result.repositories,
        totalCount: result.totalCount,
        hasMore: result.hasMore,
      };
    } catch (error) {
      logger.error('Search repositories tool failed:', error);
      throw new Error(`搜索失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
