/**
 * 按主题查询仓库工具
 * 查找包含特定主题标签的仓库
 */

import { LanceDBSearchService } from '@main/services/search/lancedb-search-service';
import { logger } from '@main/utils/logger';
import type { ITool, ToolDefinition, GetRepositoriesByTopicParams, RepositorySearchResult } from './types';

export class GetRepositoriesByTopicTool implements ITool {
  private searchService: LanceDBSearchService;

  constructor(searchService: LanceDBSearchService) {
    this.searchService = searchService;
  }

  readonly definition: ToolDefinition = {
    name: 'get_repositories_by_topic',
    description: '查找包含特定主题标签的 GitHub 仓库。主题标签是仓库的分类标签，例如：machine-learning, web-framework, cli 等。适用于用户想要查找特定领域或技术的仓库。',
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: '主题标签，例如：machine-learning, react, typescript, cli 等',
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
      required: ['topic'],
    },
  };

  async execute(params: Record<string, unknown>): Promise<RepositorySearchResult> {
    const { topic, limit = 10, sortBy = 'stars', sortOrder = 'desc' } = params as GetRepositoriesByTopicParams;

    logger.debug(`Getting repositories by topic: ${topic}`);

    try {
      // 使用搜索功能，在主题字段中查找
      const result = await this.searchService.searchRepositories({
        query: topic,
        limit: Math.min(limit, 50),
        sortBy: sortBy as 'stars' | 'updated' | 'created',
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      // 过滤出真正包含该主题的仓库
      const filteredRepositories = result.repositories.filter(repo =>
        repo.topics && repo.topics.some(t =>
          t.toLowerCase().includes(topic.toLowerCase())
        )
      );

      return {
        repositories: filteredRepositories,
        totalCount: filteredRepositories.length,
        hasMore: false,
      };
    } catch (error) {
      logger.error('Get repositories by topic tool failed:', error);
      throw new Error(`按主题查询仓库失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
