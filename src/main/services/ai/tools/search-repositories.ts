/**
 * 搜索仓库工具
 * 使用 AI SDK v5 的 tool 格式直接定义
 */

import { tool } from 'ai';
import { z } from 'zod';
import { LanceDBSearchService } from '@main/services/search/lancedb-search-service';
import { logger } from '@main/utils/logger';

let searchService: LanceDBSearchService;

export function initializeSearchRepositoriesTool(service: LanceDBSearchService) {
  searchService = service;
}

export const searchRepositoriesTool = tool({
  description: '搜索 GitHub 仓库，支持关键词匹配（仓库名称、描述、主题标签）。适用于用户想要查找特定关键词相关的仓库。',
  inputSchema: z.object({
    query: z.string().describe('搜索关键词，将在仓库名称、描述和主题中进行匹配'),
    limit: z.number().optional().default(10).describe('返回结果数量限制，默认 10，最大 50'),
    sortBy: z.enum(['relevance', 'stars', 'updated', 'created']).optional().default('relevance').describe('排序字段'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc').describe('排序顺序'),
  }),
  execute: async ({ query, limit, sortBy, sortOrder }) => {
    logger.debug(`Searching repositories with query: "${query}"`);

    try {
      const result = await searchService.searchRepositories({
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
  },
});
