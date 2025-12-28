/**
 * AI 服务
 * 使用 ProviderFactory、MiddlewareChain 和 ModelCache
 */

import {
  ChatMessage,
  AISettings,
  AIResponse,
  AIError,
  AIErrorCode,
  ChatContext,
  RepositoryReference,
} from '@shared/types';
import type { AIProviderId, ProviderAccountConfig } from '@shared/types/ai-provider';
import { logger } from '@main/utils/logger';
import { generateText } from 'ai';
import { initializeTools, tools } from './tools';
import { LanceDBSearchService } from '@main/services/search/lancedb-search-service';
import { globalProviderRegistry } from './registry-init';
import { ProviderFactory } from './providers/factory/provider-factory';
import { ModelResolver } from './core/models/model-resolver';
import { MiddlewareChain } from './core/middleware/middleware-chain';
import { LoggingMiddleware, RetryMiddleware, RateLimitMiddleware } from './core/middleware/built-in';
import { ModelCacheService } from './storage/model-cache-service';
import { ProviderAccountService } from './storage/provider-account-service';

export class AIService {
  private settings: AISettings | null = null;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();
  private searchService: LanceDBSearchService;
  private toolsInitialized = false;

  // 新架构组件
  private providerFactory: ProviderFactory;
  private modelCache: ModelCacheService;
  private middlewareChain: MiddlewareChain;
  private providerAccountService: ProviderAccountService;

  constructor() {
    this.searchService = new LanceDBSearchService();
    this.providerAccountService = ProviderAccountService.getInstance();

    // 初始化模型缓存
    this.modelCache = new ModelCacheService({
      ttl: 5 * 60 * 1000, // 5 分钟
      maxSize: 10,
      cleanupIntervalMs: 60000,
    });

    // 初始化中间件链
    this.middlewareChain = new MiddlewareChain()
      .use(new RateLimitMiddleware(60, 60000)) // 60 请求/分钟
      .use(new RetryMiddleware(3, 1000)) // 最多重试 3 次
      .use(new LoggingMiddleware());

    // 初始化 Provider 工厂
    this.providerFactory = new ProviderFactory({
      registry: globalProviderRegistry,
      modelResolver: new ModelResolver({ strictMode: false }),
      middlewareChain: this.middlewareChain,
      accountProvider: async (providerId: AIProviderId) => {
        return await this.providerAccountService.getAccount(providerId);
      },
    });
  }

  /**
   * 初始化 AI 服务
   */
  async initialize(settings: AISettings): Promise<void> {
    try {
      if (!settings.enabled) {
        throw new AIError(AIErrorCode.NOT_CONFIGURED, 'AI service not configured');
      }

      const account = this.toProviderAccountConfig(settings);
      const provider = globalProviderRegistry.getProvider(account.providerId);

      if (!provider) {
        throw new AIError(AIErrorCode.NOT_CONFIGURED, `Unknown provider: ${account.providerId}`);
      }

      if (provider.validation.apiKeyRequired && !account.apiKey) {
        throw new AIError(AIErrorCode.NOT_CONFIGURED, 'AI service not configured');
      }

      if (provider.validation.baseUrlRequired && !account.baseUrl) {
        throw new AIError(AIErrorCode.NOT_CONFIGURED, 'AI service not configured');
      }

      this.settings = settings;

      // 初始化工具系统
      if (!this.toolsInitialized) {
        await initializeTools(this.searchService);
        this.toolsInitialized = true;
      }

      logger.debug('AI service initialized with provider:', settings.provider);
    } catch (error) {
      logger.error('Failed to initialize AI service:', error);
      throw error;
    }
  }

  /**
   * 聊天方法
   */
  async chat(
    message: string,
    conversationId: string = 'default',
    userId?: string
  ): Promise<AIResponse> {
    if (!this.settings) {
      throw new AIError(AIErrorCode.NOT_CONFIGURED, 'AI service not initialized');
    }

    try {
      // 构建上下文
      const context: ChatContext = {
        conversationHistory: this.getConversationHistory(conversationId),
        userId,
      };

      // 调用 LLM（可能包含工具调用）
      const response = await this.callLLMWithTools(message, context);

      // 保存对话历史
      this.addMessageToHistory(conversationId, {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: Date.now(),
      });

      this.addMessageToHistory(conversationId, {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: response.content,
        timestamp: Date.now(),
      });

      return response;
    } catch (error) {
      logger.error('Chat error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * 获取模型实例（带缓存）
   */
  private async getModel() {
    if (!this.settings) {
      throw new AIError(AIErrorCode.NOT_CONFIGURED, 'Settings not available');
    }

    const account = this.toProviderAccountConfig(this.settings);
    const modelId = this.settings.model?.trim() || undefined;
    const modelSpec = modelId ? `${account.providerId}|${modelId}` : account.providerId;

    // 生成缓存键
    const cacheKey = ModelCacheService.generateKey(
      account.providerId,
      modelId || 'default',
      account.baseUrl
    );

    // 尝试从缓存获取
    let model = this.modelCache.get(cacheKey);
    if (model) {
      logger.debug('Using cached model:', cacheKey);
      return model;
    }

    // 创建新模型实例
    logger.debug('Creating new model:', modelSpec);
    model = await this.providerFactory.createLanguageModelWithAccount(
      account.providerId,
      account,
      modelId
    );

    // 缓存模型实例
    this.modelCache.set(cacheKey, model);

    return model;
  }

  /**
   * 调用 LLM（带工具支持）
   */
  private async callLLMWithTools(message: string, context: ChatContext): Promise<AIResponse> {
    const model = await this.getModel();
    const systemPrompt = this.buildSystemPrompt();
    const messages = this.buildMessages(message, context);

    const result = await generateText({
      model,
      system: systemPrompt,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      tools,
      temperature: this.settings!.temperature || 0.7,
      topP: this.settings!.topP || 1.0,
    });

    // 收集工具调用结果中的仓库引用
    const allReferences: RepositoryReference[] = [];
    if (result.steps && result.steps.length > 0) {
      for (const step of result.steps) {
        if (step.toolResults && step.toolResults.length > 0) {
          for (const toolResult of step.toolResults) {
            // AI SDK v5: toolResult 直接包含结果数据
            if (toolResult && typeof toolResult === 'object') {
              const resultObj = toolResult as { repositories?: RepositoryReference[] };
              if (resultObj.repositories && Array.isArray(resultObj.repositories)) {
                allReferences.push(...resultObj.repositories);
              }
            }
          }
        }
      }
    }

    return {
      content: result.text,
      references: allReferences,
      usage: {
        promptTokens: result.usage.inputTokens ?? 0,
        completionTokens: result.usage.outputTokens ?? 0,
        totalTokens: (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
      },
    };
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(): string {
    return `你是一个专业的 GitHub 仓库助手。你可以帮助用户搜索、过滤和分析 GitHub 仓库。

你有以下工具可用：
1. searchRepositories - 搜索仓库（支持关键词、排序）
2. filterRepositoriesByLanguage - 按编程语言过滤
3. filterRepositoriesByStars - 按 Star 数量过滤
4. filterRepositoriesByDate - 按日期范围过滤

请根据用户的问题，合理使用这些工具来提供准确的答案。`;
  }

  /**
   * 构建消息列表
   */
  private buildMessages(
    currentMessage: string,
    context: ChatContext
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // 添加对话历史（最近 10 条）
    const history = context.conversationHistory || [];
    const recentHistory = history.slice(-10);

    for (const msg of recentHistory) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    // 添加当前消息
    messages.push({
      role: 'user',
      content: currentMessage,
    });

    return messages;
  }

  /**
   * 转换为 ProviderAccountConfig
   */
  private toProviderAccountConfig(settings: AISettings): ProviderAccountConfig {
    return {
      providerId: settings.provider as AIProviderId,
      apiKey: settings.apiKey,
      baseUrl: settings.baseURL,
      defaultModel: settings.model,
      timeout: 30000,
      retries: 3,
      strictTLS: true,
      enabled: settings.enabled,
    };
  }

  /**
   * 获取对话历史
   */
  private getConversationHistory(conversationId: string): ChatMessage[] {
    return this.conversationHistory.get(conversationId) || [];
  }

  /**
   * 添加消息到历史
   */
  private addMessageToHistory(conversationId: string, message: ChatMessage): void {
    const history = this.conversationHistory.get(conversationId) || [];
    history.push(message);

    // 限制历史长度
    const MAX_HISTORY = 100;
    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }

    this.conversationHistory.set(conversationId, history);
  }

  /**
   * 错误处理
   */
  private handleError(error: unknown): AIError {
    if (error instanceof AIError) {
      return error;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('401') || message.includes('unauthorized')) {
        return new AIError(AIErrorCode.INVALID_API_KEY, 'Invalid API Key', 401);
      } else if (message.includes('429') || message.includes('rate limit')) {
        return new AIError(AIErrorCode.RATE_LIMITED, 'Rate limited', 429);
      }
      return new AIError(AIErrorCode.LLM_ERROR, `LLM error: ${error.message}`);
    }

    return new AIError(AIErrorCode.LLM_ERROR, `Unknown error: ${String(error)}`);
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.modelCache.stopCleanup();
    this.modelCache.clear();
    this.conversationHistory.clear();
    logger.debug('AI service cleaned up');
  }

  /**
   * 获取服务统计信息
   */
  get stats() {
    return {
      cacheStats: this.modelCache.stats,
      middlewareStats: this.middlewareChain.size,
      conversationCount: this.conversationHistory.size,
    };
  }
}
