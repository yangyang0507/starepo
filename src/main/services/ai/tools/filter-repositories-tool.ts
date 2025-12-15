/**
 * 筛选仓库工具
 * 按条件筛选仓库（语言、星数、时间范围等）
 */

import { LanceDBSearchService } from '@main/services/search/lancedb-search-service';
import { logger } from '@main/utils/logger';
import type { ITool, ToolDefinition, FilterRepositoriesParams, RepositorySearchResult } from './types';

export class FilterRepositoriesTool implements ITool {
  private searchService: LanceDBSearchService;

  constructor(searchService: LanceDBSearchService) {
    this.searchService = searchService;
  }

  readonly definition: ToolDefinition = {
    name: 'filter_repositories',
    description: '按条件筛选 GitHub 仓库，支持编程语言、星数范围、时间范围等条件。适用于用户想要查找满足特定条件的仓库。',
    parameters: {
      type: 'object',
      properties: {
        language: {
          type: 'string',
          description: '编程语言，例如：JavaScript, Python, Go, Rust 等',
        },
        minStars: {
          type: 'number',
          description: '最小星数',
        },
        maxStars: {
          type: 'number',
          description: '最大星数',
        },
        dateRange: {
          type: 'object',
          description: '时间范围筛选',
          properties: {
            field: {
              type: 'string',
              description: '时间字段',
              enum: ['created', 'updated'],
            },
            start: {
              type: 'string',
              description: '开始时间（ISO 8601 格式，例如：2024-01-01）',
            },
            end: {
              type: 'string',
              description: '结束时间（ISO 8601 格式，例如：2024-12-31）',
            },
          },
        },
        limit: {
          type: 'number',
          description: '返回结果数量限制，默认 10，最大 50',
        },
        sortBy: {
          type: 'string',
          description: '排序字段',
          enum: ['stars', 'updated', 'created'],
        },
        sortOrder: {
          type: 'string',
          description: '排序顺序',
          enum: ['asc', 'desc'],
        },
      },
    },
  };

  async execute(params: Record<string, unknown>): Promise<RepositorySearchResult> {
    const {
      language,
      minStars,
      maxStars,
      dateRange,
      limit = 10,
      sortBy = 'stars',
      sortOrder = 'desc',
    } = params as FilterRepositoriesParams;

    logger.debug('Filtering repositories with params:', params);

    try {
      // 构建筛选条件
      const searchOptions: Record<string, unknown> = {
        limit: Math.min(limit, 50),
        sortBy,
        sortOrder,
      };

      if (language) {
        searchOptions.language = language;
      }

      if (minStars !== undefined) {
        searchOptions.minStars = minStars;
      }

      if (maxStars !== undefined) {
        searchOptions.maxStars = maxStars;
      }

      // 注意：dateRange 功能需要 LanceDB 服务支持
      // 这里先传递参数，具体实现在 lancedbService 中
      if (dateRange) {
        searchOptions.dateRange = dateRange;
      }

      const result = await this.searchService.searchRepositories(searchOptions);

      return {
        repositories: result.repositories,
        totalCount: result.totalCount,
        hasMore: result.hasMore,
      };
    } catch (error) {
      logger.error('Filter repositories tool failed:', error);
      throw new Error(`筛选失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
