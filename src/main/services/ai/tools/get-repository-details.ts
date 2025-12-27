/**
 * 获取仓库详情工具
 * 使用 AI SDK v5 的 tool 格式直接定义
 */

import { tool } from 'ai';
import { z } from 'zod';
import { LanceDBSearchService } from '@main/services/search/lancedb-search-service';
import { logger } from '@main/utils/logger';

let searchService: LanceDBSearchService;

export function initializeGetRepositoryDetailsTool(service: LanceDBSearchService) {
  searchService = service;
}

export const getRepositoryDetailsTool = tool({
  description: '获取指定 GitHub 仓库的详细信息，包括描述、星数、语言、主题、更新时间等。适用于用户想要了解某个具体仓库的详细情况。',
  inputSchema: z.object({
    repositoryId: z.string().describe('仓库 ID（格式：owner/repo，例如：facebook/react）'),
  }),
  execute: async ({ repositoryId }) => {
    logger.debug(`Getting repository details for: ${repositoryId}`);

    try {
      const result = await searchService.searchRepositories({
        query: repositoryId,
        limit: 1,
      });

      if (result.repositories.length === 0) {
        logger.warn(`Repository not found: ${repositoryId}`);
        return null;
      }

      const repository = result.repositories[0];
      const fullName = `${repository.owner}/${repository.name}`;

      if (fullName.toLowerCase() !== repositoryId.toLowerCase()) {
        logger.warn(`Repository not found (no exact match): ${repositoryId}`);
        return null;
      }

      return repository;
    } catch (error) {
      logger.error('Get repository details tool failed:', error);
      throw new Error(`获取仓库详情失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});
