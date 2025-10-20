/**
 * 向量搜索服务
 * 使用 LanceDB 执行向量语义搜索
 */

import { RepositoryReference, AIError, AIErrorCode } from "@shared/types";
import { VectorSearchConfig } from "./types";
import { logger } from "@main/utils/logger";

export class VectorSearchService {
  private config: VectorSearchConfig;
  private isInitialized = false;

  constructor(config: VectorSearchConfig = {}) {
    this.config = {
      topK: config.topK || 5,
      scoreThreshold: config.scoreThreshold || 0.0, // 不过滤低分
    };
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      // TODO: 与 LanceDB 连接
      // 这里应该连接到现有的 LanceDB 实例
      this.isInitialized = true;
      logger.info("Vector search service initialized");
    } catch (error) {
      logger.error("Failed to initialize vector search service:", error);
      throw new AIError(
        AIErrorCode.SEARCH_FAILED,
        "Failed to initialize vector search service"
      );
    }
  }

  /**
   * 执行向量搜索
   */
  async search(embedding: number[]): Promise<RepositoryReference[]> {
    if (!this.isInitialized) {
      throw new AIError(
        AIErrorCode.SEARCH_FAILED,
        "Vector search service not initialized"
      );
    }

    try {
      // TODO: 执行实际的 LanceDB 向量搜索
      // 这里应该使用 LanceDB 的搜索功能
      // 返回格式: RepositoryReference[]

      // 临时实现：返回空数组
      logger.debug("Searching vectors with embedding dimension:", embedding.length);
      return [];
    } catch (error) {
      logger.error("Vector search failed:", error);
      throw new AIError(
        AIErrorCode.SEARCH_FAILED,
        `Vector search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 执行全文搜索
   */
  async fullTextSearch(query: string): Promise<RepositoryReference[]> {
    if (!this.isInitialized) {
      throw new AIError(
        AIErrorCode.SEARCH_FAILED,
        "Vector search service not initialized"
      );
    }

    try {
      // TODO: 执行 LanceDB 全文搜索
      logger.debug("Full text search query:", query);
      return [];
    } catch (error) {
      logger.error("Full text search failed:", error);
      throw new AIError(
        AIErrorCode.SEARCH_FAILED,
        `Full text search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 组合搜索：向量 + 全文
   */
  async hybridSearch(
    embedding: number[],
    query: string
  ): Promise<RepositoryReference[]> {
    try {
      const [vectorResults, fullTextResults] = await Promise.all([
        this.search(embedding),
        this.fullTextSearch(query),
      ]);

      // 合并结果并去重
      const merged = this.mergeResults(vectorResults, fullTextResults);
      return merged.slice(0, this.config.topK);
    } catch (error) {
      logger.error("Hybrid search failed:", error);
      throw new AIError(
        AIErrorCode.SEARCH_FAILED,
        `Hybrid search failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 合并搜索结果
   */
  private mergeResults(
    vectorResults: RepositoryReference[],
    fullTextResults: RepositoryReference[]
  ): RepositoryReference[] {
    const merged: Map<string, RepositoryReference> = new Map();

    // 添加向量搜索结果（权重 0.6）
    vectorResults.forEach((repo, index) => {
      const score = (1 - index / vectorResults.length) * 0.6;
      merged.set(repo.repositoryId, {
        ...repo,
        relevanceScore: repo.relevanceScore * 0.6 + score,
      });
    });

    // 添加全文搜索结果（权重 0.4）
    fullTextResults.forEach((repo, index) => {
      const score = (1 - index / fullTextResults.length) * 0.4;
      const existing = merged.get(repo.repositoryId);
      merged.set(repo.repositoryId, {
        ...repo,
        relevanceScore: existing
          ? existing.relevanceScore + score
          : repo.relevanceScore * 0.4 + score,
      });
    });

    // 按相关性分数排序
    return Array.from(merged.values()).sort(
      (a, b) => b.relevanceScore - a.relevanceScore
    );
  }

  /**
   * 获取热门仓库
   */
  async getPopularRepositories(limit: number = 10): Promise<RepositoryReference[]> {
    try {
      // TODO: 从 LanceDB 获取热门仓库
      logger.debug("Fetching popular repositories, limit:", limit);
      return [];
    } catch (error) {
      logger.error("Failed to fetch popular repositories:", error);
      throw new AIError(
        AIErrorCode.SEARCH_FAILED,
        "Failed to fetch popular repositories"
      );
    }
  }

  /**
   * 获取按语言的仓库
   */
  async getRepositoriesByLanguage(
    language: string,
    _limit: number = 10
  ): Promise<RepositoryReference[]> {
    try {
      // TODO: 从 LanceDB 获取特定语言的仓库
      logger.debug("Fetching repositories for language:", language);
      return [];
    } catch (error) {
      logger.error("Failed to fetch repositories by language:", error);
      throw new AIError(
        AIErrorCode.SEARCH_FAILED,
        "Failed to fetch repositories by language"
      );
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<VectorSearchConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug("Vector search config updated:", this.config);
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    // TODO: 关闭 LanceDB 连接
    this.isInitialized = false;
    logger.info("Vector search service closed");
  }
}
