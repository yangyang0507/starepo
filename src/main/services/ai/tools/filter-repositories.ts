/**
 * 筛选仓库工具
 * 使用 AI SDK v5 的 tool 格式直接定义
 */

import { tool } from 'ai';
import { z } from 'zod';
import { LanceDBSearchService } from '@main/services/search/lancedb-search-service';
import { logger } from '@main/utils/logger';

let searchService: LanceDBSearchService;

export function initializeFilterRepositoriesTool(service: LanceDBSearchService) {
  searchService = service;
}

export const filterRepositoriesTool = tool({
  description: '按条件筛选 GitHub 仓库，支持编程语言、星数范围、时间范围等条件。适用于用户想要查找满足特定条件的仓库。',
  inputSchema: z.object({
    language: z.string().optional().describe('编程语言，例如：JavaScript, Python, Go, Rust 等'),
    minStars: z.number().optional().describe('最小星数'),
    maxStars: z.number().optional().describe('最大星数'),
    dateRange: z.object({
      field: z.enum(['created', 'updated', 'starred']).describe('时间字段：created（创建时间）、updated（更新时间）、starred（关注时间）'),
      start: z.string().optional().describe('开始时间（ISO 8601 格式，例如：2024-01-01）'),
      end: z.string().optional().describe('结束时间（ISO 8601 格式，例如：2024-12-31）'),
    }).optional().describe('时间范围筛选'),
    limit: z.number().optional().default(10).describe('返回结果数量限制，默认 10，最大 50'),
    sortBy: z.enum(['stars', 'updated', 'created', 'starred']).optional().default('stars').describe('排序字段：stars（星数）、updated（更新时间）、created（创建时间）、starred（关注时间）'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc').describe('排序顺序'),
  }),
  execute: async ({ language, minStars, maxStars, dateRange, limit, sortBy, sortOrder }) => {
    logger.debug('Filtering repositories with params:', { language, minStars, maxStars, dateRange, limit, sortBy, sortOrder });

    try {
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

      if (dateRange) {
        searchOptions.dateRange = dateRange;
      }

      const result = await searchService.searchRepositories(searchOptions);

      return {
        repositories: result.repositories,
        totalCount: result.totalCount,
        hasMore: result.hasMore,
      };
    } catch (error) {
      logger.error('Filter repositories tool failed:', error);
      throw new Error(`筛选失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});
