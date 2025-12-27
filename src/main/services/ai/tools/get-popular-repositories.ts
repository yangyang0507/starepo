/**
 * 获取热门仓库工具
 * 使用 AI SDK v5 的 tool 格式直接定义
 */

import { tool } from 'ai';
import { z } from 'zod';
import { LanceDBSearchService } from '@main/services/search/lancedb-search-service';
import { logger } from '@main/utils/logger';

let searchService: LanceDBSearchService;

export function initializeGetPopularRepositoriesTool(service: LanceDBSearchService) {
  searchService = service;
}

export const getPopularRepositoriesTool = tool({
  description: '获取最受欢迎的 GitHub 仓库（按星数排序）。可选择性地按编程语言筛选。适用于用户想要查看热门项目或某个语言的热门项目。',
  inputSchema: z.object({
    limit: z.number().optional().default(10).describe('返回结果数量限制，默认 10，最大 50'),
    language: z.string().optional().describe('可选：按编程语言筛选，例如：JavaScript, Python, Go 等'),
  }),
  execute: async ({ limit, language }) => {
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

      const result = await searchService.searchRepositories(searchOptions);

      return {
        repositories: result.repositories,
        totalCount: result.totalCount,
        hasMore: result.hasMore,
      };
    } catch (error) {
      logger.error('Get popular repositories tool failed:', error);
      throw new Error(`获取热门仓库失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});
