/**
 * 按主题查询仓库工具
 * 使用 AI SDK v5 的 tool 格式直接定义
 */

import { tool } from 'ai';
import { z } from 'zod';
import { LanceDBSearchService } from '@main/services/search/lancedb-search-service';
import { logger } from '@main/utils/logger';

let searchService: LanceDBSearchService;

export function initializeGetRepositoriesByTopicTool(service: LanceDBSearchService) {
  searchService = service;
}

export const getRepositoriesByTopicTool = tool({
  description: '查找包含特定主题标签的 GitHub 仓库。主题标签是仓库的分类标签，例如：machine-learning, web-framework, cli 等。适用于用户想要查找特定领域或技术的仓库。',
  inputSchema: z.object({
    topic: z.string().describe('主题标签，例如：machine-learning, react, typescript, cli 等'),
    limit: z.number().optional().default(10).describe('返回结果数量限制，默认 10，最大 50'),
    sortBy: z.enum(['stars', 'updated', 'created']).optional().default('stars').describe('排序字段'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc').describe('排序顺序'),
  }),
  execute: async ({ topic, limit, sortBy, sortOrder }) => {
    logger.debug(`Getting repositories by topic: ${topic}`);

    try {
      const result = await searchService.searchRepositories({
        query: topic,
        limit: Math.min(limit, 50),
        sortBy: sortBy as 'stars' | 'updated' | 'created',
        sortOrder: sortOrder as 'asc' | 'desc',
      });

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
  },
});
