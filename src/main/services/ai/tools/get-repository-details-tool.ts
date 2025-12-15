/**
 * 获取仓库详情工具
 * 获取指定仓库的详细信息
 */

import { LanceDBSearchService } from '@main/services/search/lancedb-search-service';
import { logger } from '@main/utils/logger';
import type { ITool, ToolDefinition, GetRepositoryDetailsParams, RepositoryDetails } from './types';

export class GetRepositoryDetailsTool implements ITool {
  private searchService: LanceDBSearchService;

  constructor(searchService: LanceDBSearchService) {
    this.searchService = searchService;
  }

  readonly definition: ToolDefinition = {
    name: 'get_repository_details',
    description: '获取指定 GitHub 仓库的详细信息，包括描述、星数、语言、主题、更新时间等。适用于用户想要了解某个具体仓库的详细情况。',
    parameters: {
      type: 'object',
      properties: {
        repositoryId: {
          type: 'string',
          description: '仓库 ID（格式：owner/repo，例如：facebook/react）',
        },
      },
      required: ['repositoryId'],
    },
  };

  async execute(params: Record<string, unknown>): Promise<RepositoryDetails | null> {
    const { repositoryId } = params as GetRepositoryDetailsParams;

    logger.debug(`Getting repository details for: ${repositoryId}`);

    try {
      // 使用搜索功能精确匹配仓库名称
      const result = await this.searchService.searchRepositories({
        query: repositoryId,
        limit: 1,
      });

      if (result.repositories.length === 0) {
        logger.warn(`Repository not found: ${repositoryId}`);
        return null;
      }

      // 验证是否是精确匹配
      const repository = result.repositories[0];
      const fullName = `${repository.owner}/${repository.repositoryName}`;

      if (fullName.toLowerCase() !== repositoryId.toLowerCase()) {
        logger.warn(`Repository not found (no exact match): ${repositoryId}`);
        return null;
      }

      return repository as RepositoryDetails;
    } catch (error) {
      logger.error('Get repository details tool failed:', error);
      throw new Error(`获取仓库详情失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
