/**
 * Embedding 服务
 * 负责生成文本的向量表示
 */

import { AIError, AIErrorCode, EmbeddingCacheEntry } from "@shared/types";
import { EmbeddingServiceConfig } from "./types";
import { logger } from "@main/utils/logger";

export class EmbeddingService {
  private config: EmbeddingServiceConfig;
  private cache: Map<string, EmbeddingCacheEntry> = new Map();
  private maxCacheSize: number;

  constructor(config: EmbeddingServiceConfig) {
    this.config = config;
    this.maxCacheSize = config.cacheSize || 1000;
  }

  /**
   * 生成文本的 Embedding
   */
  async embed(text: string): Promise<number[]> {
    // 清理和标准化文本
    const normalizedText = text.trim();
    if (!normalizedText) {
      throw new AIError(
        AIErrorCode.CONFIGURATION_ERROR,
        "Cannot embed empty text"
      );
    }

    // 检查缓存
    const cacheKey = this.getCacheKey(normalizedText);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      logger.debug(`Embedding cache hit for text: ${text.substring(0, 50)}...`);
      return cached.embedding;
    }

    try {
      const embedding = await this.callEmbeddingAPI(normalizedText);

      // 缓存结果
      this.cacheEmbedding(cacheKey, normalizedText, embedding);

      return embedding;
    } catch (error) {
      logger.error("Failed to generate embedding:", error);
      throw this.handleEmbeddingError(error);
    }
  }

  /**
   * 批量生成 Embeddings
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];

    for (const text of texts) {
      const embedding = await this.embed(text);
      results.push(embedding);
    }

    return results;
  }

  /**
   * 调用 Embedding API
   */
  private async callEmbeddingAPI(text: string): Promise<number[]> {
    if (this.config.provider === "openai") {
      return this.callOpenAIEmbedding(text);
    } else if (this.config.provider === "ollama") {
      return this.callOllamaEmbedding(text);
    } else {
      throw new AIError(
        AIErrorCode.CONFIGURATION_ERROR,
        `Embedding not supported for provider: ${this.config.provider}`
      );
    }
  }

  /**
   * 调用 OpenAI Embedding API
   */
  private async callOpenAIEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model || "text-embedding-3-small",
          input: text,
          encoding_format: "float",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new AIError(
          AIErrorCode.EMBEDDING_FAILED,
          `OpenAI API error: ${errorData.error?.message || "Unknown error"}`,
          response.status,
          errorData
        );
      }

      const data = await response.json();
      return data.data[0].embedding as number[];
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      throw new AIError(
        AIErrorCode.EMBEDDING_FAILED,
        `Failed to call OpenAI Embedding API: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 调用 Ollama Embedding API（本地）
   */
  private async callOllamaEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch("http://localhost:11434/api/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model || "nomic-embed-text",
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new AIError(
          AIErrorCode.EMBEDDING_FAILED,
          `Ollama API error: ${response.status}`,
          response.status
        );
      }

      const data = await response.json();
      return data.embedding as number[];
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      throw new AIError(
        AIErrorCode.EMBEDDING_FAILED,
        `Failed to call Ollama Embedding API: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 处理 Embedding 错误
   */
  private handleEmbeddingError(error: unknown): AIError {
    if (error instanceof AIError) {
      return error;
    }

    if (error instanceof TypeError) {
      if (error.message.includes("API Key")) {
        return new AIError(AIErrorCode.INVALID_API_KEY, "Invalid API Key");
      }
      return new AIError(
        AIErrorCode.NETWORK_ERROR,
        `Network error: ${error.message}`
      );
    }

    return new AIError(
      AIErrorCode.EMBEDDING_FAILED,
      `Embedding failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  /**
   * 获取缓存 Key
   */
  private getCacheKey(text: string): string {
    // 简单的 hash 实现，可以用更好的 hash 算法替代
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `${this.config.model}:${hash}`;
  }

  /**
   * 缓存 Embedding
   */
  private cacheEmbedding(
    key: string,
    text: string,
    embedding: number[]
  ): void {
    // 如果缓存满了，删除最老的项
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      text,
      embedding,
      model: this.config.model,
      timestamp: Date.now(),
    });
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    logger.info("Embedding cache cleared");
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    size: number;
    items: number;
  } {
    return {
      size: this.cache.size,
      items: this.cache.size,
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<EmbeddingServiceConfig>): void {
    this.config = { ...this.config, ...config };
    // 配置变更时清空缓存以保证数据一致性
    this.clearCache();
  }
}
