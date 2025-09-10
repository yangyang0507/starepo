/**
 * 搜索引擎主入口
 * 提供统一的搜索服务接口，为未来的混合搜索做准备
 */

import type { GitHubRepository } from '@/services/github/types';
import type {
  SearchQuery,
  SearchResult,
  SearchSuggestion,
  SearchStats,
  SearchExplanation,
  ISearchEngine,
  SearchEngineConfig
} from './types';
import { SearchError, SearchErrorCode } from './types';
import { KeywordSearchEngine } from './keyword-search-engine';
import { DEFAULT_SEARCH_CONFIG, getRecommendedConfig } from './search-config';

/**
 * 统一搜索引擎 - 当前实现关键词搜索，为未来扩展预留接口
 */
export class UnifiedSearchEngine implements ISearchEngine {
  private keywordEngine: KeywordSearchEngine;
  private config: SearchEngineConfig;
  private isInitialized: boolean = false;

  constructor(config?: Partial<SearchEngineConfig>) {
    this.config = config ? { ...DEFAULT_SEARCH_CONFIG, ...config } : getRecommendedConfig();
    this.keywordEngine = new KeywordSearchEngine();
  }

  /**
   * 初始化搜索引擎
   */
  async initialize(repositories: GitHubRepository[]): Promise<void> {
    try {
      console.log('初始化搜索引擎...');
      await this.buildIndex(repositories);
      this.isInitialized = true;
      console.log('搜索引擎初始化完成');
    } catch (error) {
      this.isInitialized = false;
      throw new SearchError(
        '搜索引擎初始化失败',
        SearchErrorCode.INTERNAL_ERROR,
        { originalError: error }
      );
    }
  }

  /**
   * 构建搜索索引
   */
  async buildIndex(repositories: GitHubRepository[]): Promise<void> {
    if (repositories.length > this.config.indexing.maxDocuments) {
      console.warn(
        `仓库数量 (${repositories.length}) 超过配置限制 (${this.config.indexing.maxDocuments})`
      );
      repositories = repositories.slice(0, this.config.indexing.maxDocuments);
    }

    await this.keywordEngine.buildIndex(repositories);
  }

  /**
   * 更新索引
   */
  async updateIndex(repository: GitHubRepository): Promise<void> {
    await this.keywordEngine.updateIndex(repository);
  }

  /**
   * 从索引中删除文档
   */
  async removeFromIndex(repositoryId: string): Promise<void> {
    await this.keywordEngine.removeFromIndex(repositoryId);
  }

  /**
   * 执行搜索
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new SearchError(
        '搜索引擎未初始化',
        SearchErrorCode.INDEX_NOT_READY
      );
    }

    // 验证查询
    this.validateQuery(query);

    // 应用配置限制
    const limitedQuery = this.applyConfigLimits(query);

    // 根据查询类型选择搜索策略
    return this.routeSearch(limitedQuery);
  }

  /**
   * 生成搜索建议
   */
  async suggest(input: string, limit?: number): Promise<SearchSuggestion[]> {
    if (!this.isInitialized) {
      return [];
    }

    const actualLimit = Math.min(limit || 5, 20); // 限制建议数量
    return this.keywordEngine.suggest(input, actualLimit);
  }

  /**
   * 获取搜索统计信息
   */
  async getStats(): Promise<SearchStats> {
    return this.keywordEngine.getStats();
  }

  /**
   * 解释搜索过程
   */
  async explain(query: SearchQuery): Promise<SearchExplanation> {
    if (!this.isInitialized) {
      throw new SearchError(
        '搜索引擎未初始化',
        SearchErrorCode.INDEX_NOT_READY
      );
    }

    return this.keywordEngine.explain(query);
  }

  /**
   * 验证搜索查询
   */
  private validateQuery(query: SearchQuery): void {
    if (!query.text || typeof query.text !== 'string') {
      throw new SearchError(
        '搜索查询不能为空',
        SearchErrorCode.INVALID_QUERY
      );
    }

    if (query.text.trim().length === 0) {
      throw new SearchError(
        '搜索查询不能为空白',
        SearchErrorCode.INVALID_QUERY
      );
    }

    if (query.text.length > 1000) {
      throw new SearchError(
        '搜索查询过长',
        SearchErrorCode.INVALID_QUERY,
        { maxLength: 1000, actualLength: query.text.length }
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
      options
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
          { supportedTypes: ['keyword'] }
        );
      
      case 'conversational':
        // 未来实现对话式搜索
        throw new SearchError(
          '对话式搜索功能尚未实现',
          SearchErrorCode.INVALID_QUERY,
          { supportedTypes: ['keyword'] }
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
export function createSearchEngine(config?: Partial<SearchEngineConfig>): UnifiedSearchEngine {
  return new UnifiedSearchEngine(config);
}

/**
 * 便捷搜索函数
 */
export async function quickSearch(
  query: string,
  repositories?: GitHubRepository[],
  options?: Partial<SearchQuery>
): Promise<SearchResult[]> {
  const engine = getSearchEngine();
  
  // 如果提供了仓库列表且引擎未初始化，则初始化
  if (repositories && !engine.isReady()) {
    await engine.initialize(repositories);
  }

  const searchQuery: SearchQuery = {
    text: query,
    type: 'keyword',
    ...options
  };

  return engine.search(searchQuery);
}