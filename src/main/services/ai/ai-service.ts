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
  StreamChunk,
  ToolCallInfo,
} from '@shared/types';
import type { AIProviderId, ProviderAccountConfig } from '@shared/types/ai-provider';
import { logger } from '@main/utils/logger';
import { generateText, streamText, stepCountIs } from 'ai';
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
   * 流式聊天方法
   */
  async streamChat(
    message: string,
    conversationId: string = 'default',
    onChunk: (chunk: StreamChunk) => void,
    signal?: AbortSignal,
    userId?: string
  ): Promise<void> {
    if (!this.settings) {
      throw new AIError(AIErrorCode.NOT_CONFIGURED, 'AI service not initialized');
    }

    try {
      // 保存用户消息到历史
      this.addMessageToHistory(conversationId, {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: Date.now(),
      });

      // 构建上下文
      const context: ChatContext = {
        conversationHistory: this.getConversationHistory(conversationId),
        userId,
      };

      const model = await this.getModel();
      const systemPrompt = this.buildSystemPrompt();
      const messages = this.buildMessages(message, context);

      // 使用 streamText 进行流式调用
      const result = streamText({
        model,
        system: systemPrompt,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        tools,
        stopWhen: stepCountIs(5), // 🔧 允许最多 5 步（调用工具 -> 生成回复 -> 可能再次调用工具）
        temperature: this.settings!.temperature || 0.7,
        topP: this.settings!.topP || 1.0,
        abortSignal: signal,
      });

      let fullText = '';
      const allReferences: RepositoryReference[] = [];
      const activeToolCalls = new Map<string, ToolCallInfo>();
      let hasTextDelta = false; // 🔧 跟踪是否收到过 text-delta

      // 处理流式事件
      for await (const chunk of result.fullStream) {
        // 检查是否被中断
        if (signal?.aborted) {
          logger.debug('Stream aborted by signal');
          break;
        }

        switch (chunk.type) {
          case 'text-delta':
            hasTextDelta = true; // 标记收到过 text-delta
            fullText += chunk.text; // AI SDK 5 使用 text 属性
            onChunk({
              type: 'text',
              content: chunk.text,
            });
            break;

          case 'tool-call':
            {
              const toolCallInfo: ToolCallInfo = {
                id: chunk.toolCallId,
                name: chunk.toolName,
                status: 'calling',
                arguments: chunk.input as Record<string, unknown>, // AI SDK 5 使用 input
                startedAt: Date.now(),
              };
              activeToolCalls.set(chunk.toolCallId, toolCallInfo);
              onChunk({
                type: 'tool',
                content: '',
                toolCall: toolCallInfo,
              });
            }
            break;

          case 'tool-result':
            {
              const toolCallInfo = activeToolCalls.get(chunk.toolCallId);
              if (toolCallInfo) {
                toolCallInfo.status = 'result';
                toolCallInfo.result = chunk.output; // AI SDK 5 使用 output
                toolCallInfo.endedAt = Date.now();

                // 收集仓库引用
                if (chunk.output && typeof chunk.output === 'object') {
                  const resultObj = chunk.output as { repositories?: RepositoryReference[] };
                  if (resultObj.repositories && Array.isArray(resultObj.repositories)) {
                    allReferences.push(...resultObj.repositories);
                  }
                }

                onChunk({
                  type: 'tool',
                  content: '',
                  toolCall: toolCallInfo,
                });
              }
            }
            break;

          case 'error':
            {
              // AI SDK 5 的 error 可能是 errorText 或 error
              const errorMessage = (chunk as any).errorText ||
                                   ((chunk as any).error instanceof Error ? (chunk as any).error.message : String((chunk as any).error)) ||
                                   'Unknown error';
              logger.error('Stream error:', errorMessage);
              onChunk({
                type: 'error',
                content: '',
                error: errorMessage,
              });
            }
            break;

          case 'finish':
            {
              // 🔧 兜底逻辑：如果没有收到任何 text-delta，记录警告
              if (!hasTextDelta && fullText === '') {
                logger.warn('No text-delta received during stream, response may be empty');
              }

              // 发送结束事件（不再尝试从 chunk 获取 text，因为 AI SDK 5 的 finish 没有该属性）
              onChunk({
                type: 'end',
                content: fullText,
                metadata: {
                  references: allReferences.length > 0 ? allReferences : undefined,
                },
              });
            }
            break;
        }
      }

      // 保存助手消息到历史
      this.addMessageToHistory(conversationId, {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: fullText,
        timestamp: Date.now(),
        references: allReferences.length > 0 ? allReferences : undefined,
      });
    } catch (error) {
      logger.error('Stream chat error:', error);
      const aiError = this.handleError(error);
      onChunk({
        type: 'error',
        content: '',
        error: aiError.message,
      });
      throw aiError;
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
      stopWhen: stepCountIs(5), // 🔧 允许最多 5 步工具调用
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

1. **search_repositories** - 搜索仓库
   - 用途：根据关键词搜索仓库（匹配名称、描述、主题）
   - 参数：query（搜索关键词）、limit（结果数量）、sortBy（排序字段）、sortOrder（排序顺序）
   - 示例：用户问"查找 React 相关项目"时使用

2. **filter_repositories** - 筛选仓库
   - 用途：按条件筛选仓库（语言、星数、时间范围）
   - 参数：language（编程语言）、minStars/maxStars（星数范围）、dateRange（时间范围）、limit、sortBy、sortOrder
   - 示例：用户问"最近一周的 Python 项目"或"1000+ stars 的 Go 项目"时使用
   - **重要**：dateRange.field 支持三种时间字段：
     * **starred**：关注时间（用户 star 该仓库的时间）- 用于"我关注了"、"我 star 了"等查询
     * **created**：仓库创建时间
     * **updated**：仓库更新时间
   - 时间范围示例：
     * 最近一周关注的项目：dateRange.field="starred", dateRange.start="2026-01-03"（今天是 2026-01-10）
     * 最近一周更新的项目：dateRange.field="updated", dateRange.start="2026-01-03"
     * 最近一个月创建的项目：dateRange.field="created", dateRange.start="2025-12-10"

3. **get_popular_repositories** - 获取热门仓库
   - 用途：获取最受欢迎的仓库
   - 参数：limit（结果数量）、language（可选，按语言筛选）
   - 示例：用户问"最热门的项目"或"最受欢迎的 JavaScript 项目"时使用

4. **get_repository_details** - 获取仓库详情
   - 用途：获取特定仓库的详细信息
   - 参数：owner（仓库所有者）、repo（仓库名称）
   - 示例：用户问"facebook/react 的详细信息"时使用

5. **get_repositories_by_topic** - 按主题获取仓库
   - 用途：查找特定主题标签的仓库
   - 参数：topic（主题标签）、limit（结果数量）
   - 示例：用户问"machine-learning 主题的项目"时使用

重要提示：
- **当用户询问"我关注了"、"我 star 了"、"我最近关注"等问题时**，必须使用 filter_repositories 工具，并设置 dateRange.field="starred"
- 当用户询问"最近一周"、"最近一个月"等时间相关问题时，根据上下文判断：
  * 如果是"我关注的"、"我 star 的" → 使用 dateRange.field="starred"
  * 如果是"更新的"、"活跃的" → 使用 dateRange.field="updated"
  * 如果是"创建的"、"新建的" → 使用 dateRange.field="created"
- 优先使用工具获取数据，而不是直接回答"无法访问"
- 根据用户问题选择最合适的工具，可以组合使用多个工具

请根据用户的问题，主动使用这些工具来提供准确的答案。`;
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
   * 生成对话标题
   * 使用 AI 根据对话内容生成简洁的标题
   */
  async generateTitle(input: {
    conversationId: string;
    firstUserMessage: string;
    firstAssistantMessage?: string;
    tempTitle: string;
    modelId?: string;
  }): Promise<{ title: string }> {
    try {
      // 构建 Prompt
      const prompt = `请为以下对话生成一个简洁的标题（不超过20个字），只输出JSON格式：{"title":"..."}

用户：${input.firstUserMessage}
${input.firstAssistantMessage ? `助手：${input.firstAssistantMessage}` : ''}

要求：
1. 标题要简洁明了，能概括对话主题
2. 不超过20个字
3. 只输出JSON格式，不要其他内容`;

      // 获取当前启用的 Provider 账户
      const enabledAccount = await this.providerAccountService.getEnabledAccount();
      if (!enabledAccount) {
        // 如果没有启用的账户，返回临时标题
        logger.warn('[AIService] No enabled account for title generation, using temp title');
        return { title: input.tempTitle };
      }

      // 使用便宜的模型（如果可用）
      const model = await this.getModel();

      // 调用 AI 生成标题
      const result = await generateText({
        model,
        prompt,
        temperature: 0.2, // 低温度，减少随机性
        maxTokens: 50, // 限制 token 数量
      });

      // 解析 JSON 响应
      const text = result.text.trim();

      // 尝试提取 JSON
      let jsonMatch = text.match(/\{[^}]*"title"[^}]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.title && typeof parsed.title === 'string') {
          const title = parsed.title.trim();
          logger.info(`[AIService] Generated title for ${input.conversationId}: ${title}`);
          return { title };
        }
      }

      // 如果解析失败，尝试直接提取引号内的内容
      const quoteMatch = text.match(/"([^"]+)"/);
      if (quoteMatch && quoteMatch[1]) {
        const title = quoteMatch[1].trim();
        logger.info(`[AIService] Extracted title from quotes: ${title}`);
        return { title };
      }

      // 如果都失败，返回临时标题
      logger.warn('[AIService] Failed to parse title, using temp title');
      return { title: input.tempTitle };

    } catch (error) {
      logger.error('[AIService] Failed to generate title:', error);
      // 失败时返回临时标题
      return { title: input.tempTitle };
    }
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
