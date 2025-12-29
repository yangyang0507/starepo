/**
 * AI 模型发现服务
 * 负责自动拉取、缓存和管理不同 Provider 的模型列表
 */

import { logger } from '@main/utils/logger';
import {
  AI_MODEL_CACHE_TTL,
  IPC_CHANNELS,
} from '@shared/constants';
import {
  AIModel,
  AIProviderId,
  ModelListResponse,
  ProviderAccountConfig,
  ProviderDefinition,
} from '@shared/types/ai-provider';
import { getProviderDefinition } from '@shared/data/ai-providers';
import { globalProviderRegistry } from '../registry-init';
import { globalConnectionManager } from '../core/runtime/connection-manager';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// =============================================================================
// 1. 缓存相关
// =============================================================================

/**
 * 模型缓存条目
 */
interface ModelCacheEntry {
  providerId: AIProviderId;
  accountHash: string; // 基于账户配置的哈希
  models: AIModel[];
  fetchedAt: string;
  expiresAt: string;
  etag?: string;
  lastModified?: string;
}

/**
 * 模型缓存存储
 */
class ModelCacheStorage {
  private cacheFile: string;
  private cache: Map<string, ModelCacheEntry> = new Map();

  constructor() {
    this.cacheFile = path.join(os.homedir(), '.starepo', 'ai-models-cache.json');
  }

  /**
   * 加载缓存
   */
  async load(): Promise<void> {
    try {
      logger.debug(`[ModelCache] Loading cache from ${this.cacheFile}`);
      const data = await fs.readFile(this.cacheFile, 'utf8');
      const entries = JSON.parse(data) as ModelCacheEntry[];

      // 清理过期缓存
      const now = new Date();
      let validCount = 0;
      let expiredCount = 0;

      for (const entry of entries) {
        if (new Date(entry.expiresAt) > now) {
          const key = this.getCacheKey(entry.providerId, entry.accountHash);
          this.cache.set(key, entry);
          validCount++;
        } else {
          expiredCount++;
        }
      }

      logger.info(`[ModelCache] Loaded ${validCount} valid entries, ${expiredCount} expired entries`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.debug('[ModelCache] No cache file found, starting fresh');
      } else {
        logger.warn('[ModelCache] Failed to load cache:', error);
      }
    }
  }

  /**
   * 保存缓存
   */
  async save(): Promise<void> {
    try {
      const entries = Array.from(this.cache.values());
      await fs.writeFile(
        this.cacheFile,
        JSON.stringify(entries, null, 2),
        'utf8'
      );
      logger.info(`[ModelCache] Saved ${entries.length} cache entries to ${this.cacheFile}`);
    } catch (error) {
      logger.error('[ModelCache] Failed to save cache:', error);
    }
  }

  /**
   * 获取缓存
   */
  get(providerId: AIProviderId, accountHash: string): ModelCacheEntry | null {
    const key = this.getCacheKey(providerId, accountHash);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (new Date() > new Date(entry.expiresAt)) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * 设置缓存
   */
  async set(
    providerId: AIProviderId,
    accountHash: string,
    models: AIModel[],
    ttl: number = AI_MODEL_CACHE_TTL,
    etag?: string,
    lastModified?: string
  ): Promise<void> {
    const key = this.getCacheKey(providerId, accountHash);
    const now = new Date();

    const entry: ModelCacheEntry = {
      providerId,
      accountHash,
      models,
      fetchedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttl * 1000).toISOString(),
      etag,
      lastModified,
    };

    this.cache.set(key, entry);
    logger.debug(`[ModelCache] Set cache for ${providerId} (${models.length} models, ttl: ${ttl}s)`);
    await this.save();
  }

  /**
   * 清除缓存
   */
  async clear(providerId?: AIProviderId): Promise<void> {
    if (providerId) {
      // 清除特定 provider 的缓存
      for (const [key, entry] of this.cache.entries()) {
        if (entry.providerId === providerId) {
          this.cache.delete(key);
        }
      }
    } else {
      // 清除所有缓存
      this.cache.clear();
    }

    await this.save();
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(providerId: AIProviderId, accountHash: string): string {
    return `${providerId}:${accountHash}`;
  }
}

// =============================================================================
// 2. 主服务类
// =============================================================================

export class ModelDiscoveryService {
  private cacheStorage = new ModelCacheStorage();
  private isInitialized = false;

  /**
   * 获取 Provider 定义（优先从 Registry，回退到静态定义）
   */
  private getProvider(providerId: AIProviderId): ProviderDefinition | undefined {
    // 优先从动态注册表获取
    const provider = globalProviderRegistry.getProvider(providerId);
    if (provider) {
      return provider;
    }

    // 回退到静态定义
    return getProviderDefinition(providerId);
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    await this.cacheStorage.load();
    this.isInitialized = true;
    logger.info('Model discovery service initialized');
  }

  /**
   * 获取模型列表（带缓存）
   */
  async getModels(
    config: ProviderAccountConfig,
    forceRefresh: boolean = false
  ): Promise<ModelListResponse> {
    const provider = this.getProvider(config.providerId);
    if (!provider) {
      throw new Error(`Unknown provider: ${config.providerId}`);
    }

    const accountHash = this.hashAccountConfig(config);
    logger.debug(`[ModelDiscovery] Getting models for ${config.providerId}, accountHash: ${accountHash}, forceRefresh: ${forceRefresh}`);

    const cached = this.cacheStorage.get(config.providerId, accountHash);

    // 如果有有效缓存且不强制刷新，返回缓存
    if (!forceRefresh && cached) {
      logger.info(`[ModelDiscovery] Using cached models for ${config.providerId}, ${cached.models.length} models`);
      return {
        models: cached.models,
        providerId: config.providerId,
        fetchedAt: cached.fetchedAt,
        ttl: Math.floor((new Date(cached.expiresAt).getTime() - Date.now()) / 1000),
        etag: cached.etag,
        lastModified: cached.lastModified,
      };
    }

    // 如果不强制刷新且没有缓存，返回空列表（不发起网络请求）
    if (!forceRefresh && !cached) {
      logger.debug(`[ModelDiscovery] No cache available and forceRefresh=false, returning empty list for ${config.providerId}`);
      return {
        models: [],
        providerId: config.providerId,
        fetchedAt: new Date().toISOString(),
        ttl: 0,
      };
    }

    // 尝试从远程获取（只有 forceRefresh=true 时才会到这里）
    try {
      logger.debug(`[ModelDiscovery] Fetching models from remote for ${config.providerId}`);
      const response = await this.fetchModelsFromRemote(config);

      logger.info(`[ModelDiscovery] Successfully fetched ${response.models.length} models from ${config.providerId}, caching...`);

      // 缓存结果
      await this.cacheStorage.set(
        config.providerId,
        accountHash,
        response.models,
        response.ttl,
        response.etag,
        response.lastModified
      );

      logger.debug(`[ModelDiscovery] Models cached successfully for ${config.providerId}`);

      return response;
    } catch (error) {
      logger.error(`[ModelDiscovery] Failed to fetch models for ${config.providerId}:`, error);

      // 如果远程获取失败但有缓存，返回缓存（即使过期）
      if (cached) {
        logger.warn(`[ModelDiscovery] Using expired cache for ${config.providerId}, ${cached.models.length} models`);
        return {
          models: cached.models,
          providerId: config.providerId,
          fetchedAt: cached.fetchedAt,
          ttl: 0, // 标记为过期
          etag: cached.etag,
          lastModified: cached.lastModified,
        };
      }

      // 最后的兜底：返回预定义模型
      logger.warn(`[ModelDiscovery] No cache available, using predefined models for ${config.providerId}`);
      return {
        models: this.getPredefinedModels(config.providerId),
        providerId: config.providerId,
        fetchedAt: new Date().toISOString(),
        ttl: 0,
      };
    }
  }

  /**
   * 测试连接并获取模型
   */
  async testConnection(config: ProviderAccountConfig): Promise<{
    success: boolean;
    message: string;
    modelCount?: number;
    latency?: number;
  }> {
    const startTime = Date.now();

    try {
      const provider = this.getProvider(config.providerId);
      if (!provider) {
        return {
          success: false,
          message: `未知的 Provider: ${config.providerId}`,
        };
      }

      // 验证必要配置
      if (provider.validation.apiKeyRequired && !config.apiKey) {
        return {
          success: false,
          message: '此 Provider 需要 API Key',
        };
      }

      // 健康检查
      const healthOk = await this.performHealthCheck(provider, config);
      if (!healthOk) {
        return {
          success: false,
          message: '连接失败：无法访问服务端点',
        };
      }

      // 尝试获取模型
      const response = await this.getModels(config, true); // 强制刷新
      const latency = Date.now() - startTime;

      return {
        success: true,
        message: '连接成功',
        modelCount: response.models.length,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      const message = error instanceof Error ? error.message : '未知错误';

      return {
        success: false,
        message: `连接失败: ${message}`,
        latency,
      };
    }
  }

  /**
   * 清除模型缓存
   */
  async clearCache(providerId?: AIProviderId): Promise<void> {
    await this.cacheStorage.clear(providerId);
    logger.info(`Cleared model cache${providerId ? ` for ${providerId}` : ''}`);
  }

  /**
   * 获取预定义模型列表（兜底用）
   */
  private getPredefinedModels(providerId: AIProviderId): AIModel[] {
    const provider = this.getProvider(providerId);
    if (!provider || !provider.defaults.models) {
      return [];
    }

    return provider.defaults.models.map(modelId => ({
      id: modelId,
      displayName: modelId,
      providerId,
      deprecated: false,
      tags: ['fallback'],
    }));
  }

  /**
   * 从远程获取模型列表
   */
  private async fetchModelsFromRemote(config: ProviderAccountConfig): Promise<ModelListResponse> {
    const provider = this.getProvider(config.providerId);
    if (!provider || !provider.validation.supportsModelListing) {
      throw new Error(`Provider ${config.providerId} does not support model listing`);
    }

    const baseUrl = config.baseUrl || provider.defaults.baseUrl;
    if (!baseUrl) {
      throw new Error(`No base URL configured for ${config.providerId}`);
    }

    // 构建请求
    const url = `${baseUrl}${(provider.protocol as string) === 'ollama' ? '/api/tags' : '/models'}`;
    const headers: Record<string, string> = {};

    // 添加认证头
    if (config.apiKey) {
      if (provider.auth.type === 'bearer_token') {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      } else if (provider.auth.type === 'api_key_header') {
        headers[provider.auth.keyHeader || 'x-api-key'] = config.apiKey;
      }
    }

    // 添加自定义头
    if (provider.auth.customHeaders) {
      Object.assign(headers, provider.auth.customHeaders);
    }
    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders);
    }

    // 发送请求（带重试）
    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Fetching models from ${url} (attempt ${attempt}/${maxRetries})`);

        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(config.timeout || 30000),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const models = this.parseModelResponse(config.providerId, data);

        logger.info(`Successfully fetched ${models.length} models from ${config.providerId}`);

        return {
          models,
          providerId: config.providerId,
          fetchedAt: new Date().toISOString(),
          ttl: 3600, // 1 小时缓存
          etag: response.headers.get('etag') || undefined,
          lastModified: response.headers.get('last-modified') || undefined,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Attempt ${attempt}/${maxRetries} failed:`, lastError.message);

        // 如果不是最后一次尝试，等待后重试
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // 指数退避，最多 5 秒
          logger.debug(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // 所有重试都失败
    throw lastError || new Error('Failed to fetch models after retries');
  }

  /**
   * 解析模型列表响应
   */
  private parseModelResponse(providerId: AIProviderId, data: any): AIModel[] {
    // OpenAI 格式
    if (data.data && Array.isArray(data.data)) {
      return data.data.map((model: any) => ({
        id: model.id,
        displayName: model.id,
        providerId,
        capabilities: {
          maxTokens: model.max_tokens || undefined,
          supportsStreaming: true,
        },
      }));
    }

    // Ollama 格式
    if (data.models && Array.isArray(data.models)) {
      return data.models.map((model: any) => ({
        id: model.name,
        displayName: `${model.name}:${model.tag || 'latest'}`,
        providerId,
        capabilities: {
          maxTokens: undefined, // Ollama 不提供此信息
          supportsStreaming: true,
        },
        tags: [model.digest?.slice(0, 7) || 'local'],
      }));
    }

    // 未知格式
    logger.warn('Unknown model list response format:', data);
    return [];
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(
    provider: ProviderDefinition,
    config: ProviderAccountConfig
  ): Promise<boolean> {
    if (!provider.healthCheck) {
      return true; // 如果没有健康检查配置，跳过
    }

    const baseUrl = config.baseUrl || provider.defaults.baseUrl;
    if (!baseUrl) {
      return false;
    }

    try {
      const url = `${baseUrl}${provider.healthCheck.endpoint}`;
      const headers: Record<string, string> = {};

      if (config.apiKey && provider.auth.type !== 'no_auth') {
        if (provider.auth.type === 'bearer_token') {
          headers['Authorization'] = `Bearer ${config.apiKey}`;
        } else if (provider.auth.type === 'api_key_header') {
          headers[provider.auth.keyHeader || 'x-api-key'] = config.apiKey;
        }
      }

      const response = await fetch(url, {
        method: provider.healthCheck.method,
        headers,
        signal: AbortSignal.timeout(5000), // 健康检查使用较短超时
      });

      return response.status === provider.healthCheck.expectedStatus;
    } catch (error) {
      logger.debug('Health check failed:', error);
      return false;
    }
  }

  /**
   * 生成账户配置的哈希值（用于缓存键）
   */
  private hashAccountConfig(config: ProviderAccountConfig): string {
    const relevantFields = {
      providerId: config.providerId,
      baseUrl: config.baseUrl,
      // 不包含 apiKey，因为它变化时应该清除缓存
      customHeaders: config.customHeaders,
    };

    const content = JSON.stringify(relevantFields, Object.keys(relevantFields).sort());
    return require('crypto').createHash('md5').update(content).digest('hex');
  }
}

// =============================================================================
// 3. 单例实例
// =============================================================================

export const modelDiscoveryService = new ModelDiscoveryService();