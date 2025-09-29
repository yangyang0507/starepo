import { lancedbService } from '../database/lancedb-service';
import type { GitHubRepository } from '../../../shared/types/index.js';

/**
 * 基于 LanceDB 的搜索服务
 * 提供全文检索、语义搜索和高级筛选功能
 */
export class LanceDBSearchService {
  private initialized = false;

  /**
   * 初始化搜索服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // 确保 LanceDB 服务已初始化
    await lancedbService.initialize();

    this.initialized = true;
    console.log('LanceDB 搜索服务初始化成功');
  }

  /**
   * 确保服务已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('LanceDB 搜索服务未初始化，请先调用 initialize()');
    }
  }

  /**
   * 全文搜索仓库
   */
  async searchRepositories(options: {
    query?: string;
    language?: string;
    minStars?: number;
    maxStars?: number;
    limit?: number;
    sortBy?: 'relevance' | 'stars' | 'updated' | 'created';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    repositories: GitHubRepository[];
    totalCount: number;
    searchTime: number;
  }> {
    this.ensureInitialized();

    const startTime = Date.now();
    const {
      query = '',
      language,
      minStars,
      maxStars,
      limit = 50,
      sortBy = 'relevance',
      sortOrder = 'desc'
    } = options;

    try {
      let repositories: GitHubRepository[] = [];

      if (query) {
        // 使用 LanceDB 的语义搜索
        const searchResult = await lancedbService.searchRepositories(query, limit);
        repositories = searchResult.items;
      } else {
        // 如果没有查询文本，获取所有仓库
        repositories = await lancedbService.getAllRepositories(limit);
      }

      // 应用语言筛选
      if (language) {
        const filteredByLanguage = await lancedbService.getRepositoriesByLanguage(language, limit);
        if (query) {
          // 如果有查询文本，取交集
          const searchedIds = new Set(repositories.map(r => r.id));
          repositories = filteredByLanguage.filter(r => searchedIds.has(r.id));
        } else {
          repositories = filteredByLanguage;
        }
      }

      // 应用 star 数量筛选
      if (minStars !== undefined || maxStars !== undefined) {
        const min = minStars ?? 0;
        const max = maxStars ?? Number.MAX_SAFE_INTEGER;

        const filteredByStars = await lancedbService.getRepositoriesByStarRange(min, max, limit);
        if (query || language) {
          // 如果有其他筛选条件，取交集
          const filteredIds = new Set(repositories.map(r => r.id));
          repositories = filteredByStars.filter(r => filteredIds.has(r.id));
        } else {
          repositories = filteredByStars;
        }
      }

      // 应用排序
      repositories = this.sortRepositories(repositories, sortBy, sortOrder);

      // 限制结果数量
      repositories = repositories.slice(0, limit);

      const searchTime = Date.now() - startTime;

      return {
        repositories,
        totalCount: repositories.length,
        searchTime
      };
    } catch (error) {
      console.error('搜索仓库失败:', error);
      throw error;
    }
  }

  /**
   * 获取搜索建议
   */
  async getSearchSuggestions(input: string, limit: number = 10): Promise<{
    terms: string[];
    languages: string[];
    topics: string[];
  }> {
    this.ensureInitialized();

    try {
      // 基于输入获取建议
      const searchResult = await lancedbService.searchRepositories(input, limit);

      // 提取语言建议
      const languages = Array.from(new Set(
        searchResult.items
          .map(repo => repo.language)
          .filter((lang): lang is string => Boolean(lang))
      )).slice(0, limit);

      // 提取主题建议
      const topics = Array.from(new Set(
        searchResult.items
          .flatMap(repo => repo.topics || [])
          .filter(topic => topic.toLowerCase().includes(input.toLowerCase()))
      )).slice(0, limit);

      // 简单的搜索词建议（基于仓库名称和描述）
      const terms = Array.from(new Set(
        searchResult.items
          .flatMap(repo => [
            repo.name,
            ...(repo.description?.split(/\s+/) || [])
          ])
          .filter(term =>
            term.toLowerCase().includes(input.toLowerCase()) &&
            term.length > 2
          )
      )).slice(0, limit);

      return {
        terms: terms.slice(0, 5),
        languages: languages.slice(0, 5),
        topics: topics.slice(0, 5)
      };
    } catch (error) {
      console.error('获取搜索建议失败:', error);
      return {
        terms: [],
        languages: [],
        topics: []
      };
    }
  }

  /**
   * 获取热门搜索词
   */
  async getPopularSearchTerms(limit: number = 10): Promise<{
    languages: Array<{ name: string; count: number }>;
    topics: Array<{ name: string; count: number }>;
  }> {
    this.ensureInitialized();

    try {
      // 获取所有仓库来计算统计信息
      const repositories = await lancedbService.getAllRepositories(1000); // 限制样本大小

      // 计算语言统计
      const languageStats = new Map<string, number>();
      const topicStats = new Map<string, number>();

      repositories.forEach(repo => {
        // 统计语言
        if (repo.language) {
          languageStats.set(repo.language, (languageStats.get(repo.language) || 0) + 1);
        }

        // 统计主题
        repo.topics?.forEach(topic => {
          topicStats.set(topic, (topicStats.get(topic) || 0) + 1);
        });
      });

      // 排序并限制结果
      const languages = Array.from(languageStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, count]) => ({ name, count }));

      const topics = Array.from(topicStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, count]) => ({ name, count }));

      return {
        languages,
        topics
      };
    } catch (error) {
      console.error('获取热门搜索词失败:', error);
      return {
        languages: [],
        topics: []
      };
    }
  }

  /**
   * 获取搜索统计信息
   */
  async getSearchStats(): Promise<{
    totalRepositories: number;
    totalUsers: number;
    indexSize: number;
  }> {
    this.ensureInitialized();

    try {
      const stats = await lancedbService.getStats();
      return {
        totalRepositories: stats.repositoriesCount,
        totalUsers: stats.usersCount,
        indexSize: stats.tablesCount
      };
    } catch (error) {
      console.error('获取搜索统计失败:', error);
      return {
        totalRepositories: 0,
        totalUsers: 0,
        indexSize: 0
      };
    }
  }

  /**
   * 排序仓库
   */
  private sortRepositories(
    repositories: GitHubRepository[],
    sortBy: 'relevance' | 'stars' | 'updated' | 'created',
    sortOrder: 'asc' | 'desc'
  ): GitHubRepository[] {
    const multiplier = sortOrder === 'desc' ? -1 : 1;

    return repositories.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'stars': {
          comparison = (a.stargazers_count - b.stargazers_count) * multiplier;
          break;
        }
        case 'updated': {
          comparison = (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()) * multiplier;
          break;
        }
        case 'created': {
          comparison = (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * multiplier;
          break;
        }
        case 'relevance':
        default: {
          // 对于相关性，我们使用综合评分：star数 + 最近更新程度
          const scoreA = a.stargazers_count + (Date.now() - new Date(a.updated_at).getTime()) / (1000 * 60 * 60 * 24 * 365); // 年数作为衰减因子
          const scoreB = b.stargazers_count + (Date.now() - new Date(b.updated_at).getTime()) / (1000 * 60 * 60 * 24 * 365);
          comparison = (scoreA - scoreB) * multiplier;
          break;
        }
      }

      return comparison;
    });
  }
}

// 导出单例实例
export const lancedbSearchService = new LanceDBSearchService();