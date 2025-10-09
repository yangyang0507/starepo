import { lancedbService } from '../database/lancedb-service';
import type { GitHubRepository } from '../../../shared/types/index.js';
import { getLogger } from '../../utils/logger';

interface SearchCacheEntry {
  timestamp: number;
  result: SearchResponse;
}

type SortField = 'relevance' | 'stars' | 'updated' | 'created';
type SortOrder = 'asc' | 'desc';

interface SearchOptions {
  query?: string;
  language?: string;
  minStars?: number;
  maxStars?: number;
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  disableCache?: boolean;
}

interface SearchResponse {
  repositories: GitHubRepository[];
  totalCount: number;
  searchTime: number;
  page: number;
  pageSize: number;
  offset: number;
  hasMore: boolean;
  nextOffset?: number;
  cached?: boolean;
}

/**
 * 基于 LanceDB 的搜索服务
 * 提供全文检索、语义搜索和高级筛选功能
 */
export class LanceDBSearchService {
  private initialized = false;
  private readonly cache = new Map<string, SearchCacheEntry>();
  private readonly cacheTTL = 30 * 1000; // 30 秒
  private readonly cacheLimit = 50;
  private readonly log = getLogger('search:lancedb');

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
    this.log.info('LanceDB 搜索服务初始化成功');
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
  async searchRepositories(options: SearchOptions = {}): Promise<SearchResponse> {
    this.ensureInitialized();

    const startTime = Date.now();
    const {
      query = '',
      language,
      minStars,
      maxStars,
      limit,
      page,
      pageSize,
      offset,
      sortBy = 'relevance',
      sortOrder = 'desc',
      disableCache = false
    } = options;

    const normalizedPageSize = this.normalizePageSize(pageSize ?? limit ?? 50);
    const normalizedPage = this.normalizePage(page);
    const normalizedOffset = this.normalizeOffset(offset ?? (normalizedPage - 1) * normalizedPageSize);
    const normalizedLimit = normalizedPageSize;

    const cacheKey = this.buildCacheKey({
      query,
      language,
      minStars,
      maxStars,
      limit: normalizedLimit,
      offset: normalizedOffset,
      sortBy,
      sortOrder
    });

    if (!disableCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          ...cached,
          searchTime: Date.now() - startTime,
          cached: true
        };
      }
    }

    try {
      const whereClause = this.buildWhereClause({ language, minStars, maxStars });
      const fetchLimit = normalizedLimit + normalizedOffset + 1;

      const searchResult = await lancedbService.searchRepositories(
        query,
        fetchLimit,
        whereClause
      );

      const sortedItems = this.sortRepositories(
        [...searchResult.items],
        sortBy,
        sortOrder
      );

      const pagedItems = this.sliceWithOffset(
        sortedItems,
        normalizedOffset,
        normalizedLimit
      );

      const hasMore = sortedItems.length > normalizedOffset + pagedItems.length;
      const totalCount = Math.max(
        searchResult.totalCount,
        normalizedOffset + pagedItems.length + (hasMore ? 1 : 0)
      );

      const searchTime = Date.now() - startTime;

      const response: SearchResponse = {
        repositories: pagedItems.slice(0, normalizedLimit),
        totalCount,
        searchTime,
        page: normalizedPage,
        pageSize: normalizedPageSize,
        offset: normalizedOffset,
        hasMore,
        nextOffset: hasMore ? normalizedOffset + normalizedLimit : undefined,
        cached: false
      };

      if (!disableCache) {
        this.saveToCache(cacheKey, response);
      }

      return response;
    } catch (error) {
      this.log.error('搜索仓库失败', error);
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
      this.log.error('获取搜索建议失败', error);
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
      this.log.error('获取热门搜索词失败', error);
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
      this.log.error('获取搜索统计失败', error);
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
    sortBy: SortField,
    sortOrder: SortOrder
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

  /**
   * 构造缓存键
   */
  private buildCacheKey(params: Record<string, unknown>): string {
    return JSON.stringify(params);
  }

  private getFromCache(cacheKey: string): SearchResponse | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.cacheTTL) {
      this.cache.delete(cacheKey);
      return null;
    }

    return {
      ...entry.result,
      repositories: entry.result.repositories.map(repo => ({ ...repo }))
    };
  }

  private saveToCache(cacheKey: string, result: SearchResponse): void {
    this.cache.set(cacheKey, {
      timestamp: Date.now(),
      result: {
        ...result,
        // 避免缓存被外部修改
        repositories: result.repositories.map(repo => ({ ...repo }))
      }
    });

    if (this.cache.size > this.cacheLimit) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * 将数据库结果按 offset/limit 分页
   */
  private sliceWithOffset<T>(items: T[], offset: number, limit: number): T[] {
    if (offset <= 0) {
      return items.slice(0, limit);
    }
    return items.slice(offset, offset + limit);
  }

  /**
   * 构造过滤条件
   */
  private buildWhereClause(filters: {
    language?: string;
    minStars?: number;
    maxStars?: number;
  }): string | undefined {
    const conditions: string[] = [];

    if (filters.language) {
      conditions.push(`language = '${this.escapeSqlString(filters.language)}'`);
    }

    const minInput = filters.minStars;
    const maxInput = filters.maxStars;
    const hasMin = typeof minInput === 'number' && Number.isFinite(minInput);
    const hasMax = typeof maxInput === 'number' && Number.isFinite(maxInput);

    if (hasMin || hasMax) {
      const min = hasMin ? Math.max(0, Math.floor(minInput as number)) : 0;
      const maxCandidate = hasMax ? Math.floor(maxInput as number) : Number.MAX_SAFE_INTEGER;
      const max = Math.max(min, maxCandidate);
      conditions.push(`stargazers_count >= ${min} AND stargazers_count <= ${max}`);
    }

    return conditions.length ? conditions.join(' AND ') : undefined;
  }

  private normalizePage(page?: number): number {
    if (typeof page !== 'number' || !Number.isFinite(page)) {
      return 1;
    }
    return Math.max(1, Math.floor(page));
  }

  private normalizePageSize(pageSize: number): number {
    if (!Number.isFinite(pageSize) || pageSize <= 0) {
      return 50;
    }
    return Math.min(200, Math.max(1, Math.floor(pageSize)));
  }

  private normalizeOffset(offset: number): number {
    if (!Number.isFinite(offset) || offset <= 0) {
      return 0;
    }
    return Math.max(0, Math.floor(offset));
  }

  private escapeSqlString(value: string): string {
    return value.replace(/'/g, "''");
  }

  /**
   * 主动清理缓存，供外部服务调用
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// 导出单例实例
export const lancedbSearchService = new LanceDBSearchService();
