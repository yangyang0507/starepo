/**
 * 搜索引擎主入口
 * 提供统一的搜索服务接口，为未来的混合搜索做准备
 */

import type {
  GitHubRepository,
  SearchQuery,
  SearchResult,
  SearchSuggestion,
  SearchAnalyticsStats,
  SearchPerformanceStats,
  SearchExplanation,
  ISearchEngine,
  SearchEngineConfig,
  SearchHistoryItem,
} from './types';
import { SearchError, SearchErrorCode } from './types';
import { KeywordSearchEngine } from './keyword-search-engine';
import { DEFAULT_SEARCH_CONFIG, getRecommendedConfig } from './search-config';
import { searchHistoryService } from './history-service';

/**
 * 统一搜索引擎 - 当前实现关键词搜索，为未来扩展预留接口
 */
export class UnifiedSearchEngine implements ISearchEngine {
  private keywordEngine: KeywordSearchEngine;
  private config: SearchEngineConfig;
  private isInitialized: boolean = false;
  private repositories: Map<string, GitHubRepository> = new Map();

  constructor(config?: Partial<SearchEngineConfig>) {
    this.config =
      config ? { ...DEFAULT_SEARCH_CONFIG, ...config } : getRecommendedConfig();
    this.keywordEngine = new KeywordSearchEngine();
  }

  /**
   * 初始化搜索引擎
   */
  async initialize(repositories: GitHubRepository[]): Promise<void> {
    try {
      console.log('Initializing Unified Search Engine...');
      await Promise.all([
        this.buildIndex(repositories),
      ]);
      this.isInitialized = true;
      console.log('Unified Search Engine initialized successfully.');
    } catch (error) {
      this.isInitialized = false;
      throw new SearchError(
        '搜索引擎初始化失败',
        SearchErrorCode.INTERNAL_ERROR,
        { originalError: error },
      );
    }
  }

  /**
   * 构建搜索索引
   */
  async buildIndex(repositories: GitHubRepository[]): Promise<void> {
    if (repositories.length > this.config.indexing.maxDocuments) {
      console.warn(
        `仓库数量 (${repositories.length}) 超过配置限制 (${this.config.indexing.maxDocuments})`,
      );
      repositories = repositories.slice(0, this.config.indexing.maxDocuments);
    }

    // Store repositories for lookup
    this.repositories.clear();
    for (const repo of repositories) {
      this.repositories.set(repo.id.toString(), repo);
    }

    await Promise.all([
      this.keywordEngine.buildIndex(repositories),
    ]);
  }

  /**
   * 更新索引
   */
  async updateIndex(repository: GitHubRepository): Promise<void> {
    this.repositories.set(repository.id.toString(), repository);
    await Promise.all([
      this.keywordEngine.updateIndex(repository),
      // Note: Updating semantic index efficiently requires more complex logic (e.g., re-indexing in batches).
      // For now, we'll accept that the semantic index might become stale until a full rebuild.
    ]);
  }

  /**
   * 从索引中删除文档
   */
  async removeFromIndex(repositoryId: string): Promise<void> {
    this.repositories.delete(repositoryId);
    await Promise.all([
      this.keywordEngine.removeFromIndex(repositoryId),
      // Note: Removing from HNSWLib index is not straightforward. A full rebuild is often easier.
    ]);
  }

  /**
   * 执行搜索
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new SearchError(
        '搜索引擎未初始化',
        SearchErrorCode.INDEX_NOT_READY,
      );
    }

    // 验证查询
    this.validateQuery(query);

    // 应用配置限制
    const limitedQuery = this.applyConfigLimits(query);

    try {
      const startTime = Date.now();

      // 根据查询类型选择搜索策略
      const results = await this.routeSearch(limitedQuery);

      const searchTime = Date.now() - startTime;

      // 记录搜索历史（只有非空搜索才记录）
      if (query.text.trim().length > 0) {
        await this.recordSearchHistory(query, results.length, searchTime);
      }

      return results;
    } catch (error) {
      // 搜索失败也记录历史（用于错误分析）
      if (query.text.trim().length > 0) {
        await this.recordSearchHistory(query, 0, 0, error as Error);
      }
      throw error;
    }
  }

  /**
   * 生成搜索建议
   */
  async suggest(input: string, limit?: number): Promise<SearchSuggestion[]> {
    if (!this.isInitialized) {
      return [];
    }

    const actualLimit = Math.min(limit || 10, 20);

    // 获取多个来源的建议
    const allSuggestions: SearchSuggestion[] = [];

    // 1. 关键词建议（来自关键词引擎）
    const keywordSuggestions = await this.keywordEngine.suggest(
      input,
      Math.floor(actualLimit / 2),
    );
    allSuggestions.push(...keywordSuggestions);

    // 2. 历史和建议（来自历史服务）
    const historySuggestions = await searchHistoryService.getSuggestions(input);
    allSuggestions.push(...historySuggestions);

    // 去重和排序
    return this.deduplicateSuggestions(allSuggestions, input).slice(
      0,
      actualLimit,
    );
  }

  /**
   * 去重和排序建议
   */
  private deduplicateSuggestions(
    suggestions: SearchSuggestion[],
    input: string,
  ): SearchSuggestion[] {
    const seen = new Set<string>();
    const uniqueSuggestions: SearchSuggestion[] = [];

    for (const suggestion of suggestions) {
      if (!seen.has(suggestion.text)) {
        seen.add(suggestion.text);
        uniqueSuggestions.push(suggestion);
      }
    }

    // 按分数排序（如果存在分数）
    return uniqueSuggestions.sort((a, b) => {
      const scoreA = a.score || this.calculateSuggestionScore(a, input);
      const scoreB = b.score || this.calculateSuggestionScore(b, input);
      return scoreB - scoreA;
    });
  }

  /**
   * 计算建议分数
   */
  private calculateSuggestionScore(
    suggestion: SearchSuggestion,
    input: string,
  ): number {
    const { text, type } = suggestion;
    const inputLower = input.toLowerCase();
    const textLower = text.toLowerCase();

    let score = 0;

    // 类型权重
    if (type === 'history') score += 20;
    if (type === 'popular') score += 15;
    if (type === 'completion') score += 10;
    if (type === 'correction') score += 5;

    // 匹配质量
    if (textLower === inputLower) score += 30;
    if (textLower.startsWith(inputLower)) score += 20;
    if (textLower.includes(inputLower)) score += 10;

    return score;
  }

  /**
   * 获取搜索历史
   */
  async getSearchHistory(limit?: number): Promise<SearchHistoryItem[]> {
    return searchHistoryService.getRecentSearches(limit);
  }

  /**
   * 获取热门搜索
   */
  async getPopularSearches(limit?: number): Promise<SearchSuggestion[]> {
    return searchHistoryService.getPopularSearches(limit);
  }

  /**
   * 获取搜索分析统计
   */
  async getSearchStatistics(): Promise<SearchAnalyticsStats> {
    return searchHistoryService.getSearchStats();
  }

  /**
   * 清除搜索历史
   */
  async clearSearchHistory(): Promise<void> {
    await searchHistoryService.clearHistory();
  }

  /**
   * 获取搜索引擎性能统计
   */
  async getStats(): Promise<SearchPerformanceStats> {
    return this.keywordEngine.getStats();
  }

  /**
   * 解释搜索过程
   */
  async explain(query: SearchQuery): Promise<SearchExplanation> {
    if (!this.isInitialized) {
      throw new SearchError(
        '搜索引擎未初始化',
        SearchErrorCode.INDEX_NOT_READY,
      );
    }

    return this.keywordEngine.explain(query);
  }

  /**
   * 验证搜索查询
   */
  private validateQuery(query: SearchQuery): void {
    if (typeof query.text !== 'string') {
      throw new SearchError(
        '搜索查询必须为字符串',
        SearchErrorCode.INVALID_QUERY,
      );
    }

    if (query.text.length > 1000) {
      throw new SearchError(
        '搜索查询过长',
        SearchErrorCode.INVALID_QUERY,
        { maxLength: 1000, actualLength: query.text.length },
      );
    }
  }

  /**
   * 应用配置限制
   */
  private applyConfigLimits(query: SearchQuery): SearchQuery {
    const options = query.options || {};

    // 限制结果数量
    if (options.limit) {
      options.limit = Math.min(options.limit, this.config.search.maxLimit);
    } else {
      options.limit = this.config.search.defaultLimit;
    }

    // 设置偏移量
    if (!options.offset) {
      options.offset = 0;
    }

    return {
      ...query,
      options,
    };
  }

  /**
   * 路由搜索请求
   */
  private async routeSearch(query: SearchQuery): Promise<SearchResult[]> {
    // 当前只支持关键词搜索
    // 未来可以根据查询类型和内容智能选择搜索引擎

    switch (query.type) {
      case 'keyword':
      case 'hybrid': // 暂时回退到关键词搜索
      default:
        return this.keywordEngine.search(query);

      case 'semantic':
        // 未来实现语义搜索
        throw new SearchError(
          '语义搜索功能尚未实现',
          SearchErrorCode.INVALID_QUERY,
          { supportedTypes: ['keyword'] },
        );

      case 'conversational':
        // 未来实现对话式搜索
        throw new SearchError(
          '对话式搜索功能尚未实现',
          SearchErrorCode.INVALID_QUERY,
          { supportedTypes: ['keyword'] },
        );
    }
  }

  /**
   * 获取搜索引擎配置
   */
  getConfig(): SearchEngineConfig {
    return { ...this.config };
  }

  /**
   * 更新搜索引擎配置
   */
  updateConfig(newConfig: Partial<SearchEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 检查搜索引擎是否就绪
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 记录搜索历史
   */
  private async recordSearchHistory(
    query: SearchQuery,
    resultCount: number,
    executionTime: number,
    error?: Error,
  ): Promise<void> {
    try {
      await searchHistoryService.addToHistory({
        query: query.text,
        type: query.type,
        resultCount,
        executionTime,
        filters: query.options?.filters,
        error: error ? String(error) : undefined,
      });
    } catch (historyError) {
      console.warn('记录搜索历史失败:', historyError);
      // 不抛出错误，避免影响主搜索流程
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.isInitialized = false;
    // 清理缓存、停止定时器等
  }
}

// 导出类型和工具
export * from './types';
export * from './search-config';
export { TextAnalyzer } from './text-analyzer';
export { SearchIndexManager } from './search-index';
export { KeywordSearchEngine } from './keyword-search-engine';

// 创建默认搜索引擎实例
let defaultSearchEngine: UnifiedSearchEngine | null = null;

/**
 * 获取默认搜索引擎实例
 */
export function getSearchEngine(): UnifiedSearchEngine {
  if (!defaultSearchEngine) {
    defaultSearchEngine = new UnifiedSearchEngine();
  }
  return defaultSearchEngine;
}

/**
 * 创建新的搜索引擎实例
 */
export function createSearchEngine(
  config?: Partial<SearchEngineConfig>,
): UnifiedSearchEngine {
  return new UnifiedSearchEngine(config);
}

/**
 * 便捷搜索函数
 */
export async function quickSearch(
  query: string,
  repositories?: GitHubRepository[],
  options?: Partial<SearchQuery>,
): Promise<SearchResult[]> {
  const engine = getSearchEngine();

  // 如果提供了仓库列表且引擎未初始化，则初始化
  if (repositories && !engine.isReady()) {
    await engine.initialize(repositories);
  }

  const searchQuery: SearchQuery = {
    text: query,
    type: 'keyword',
    ...options,
  };

  return engine.search(searchQuery);
}