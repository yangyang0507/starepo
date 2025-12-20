/**
 * AI 服务
 * 基于 AI SDK V5 的 AI 对话功能，支持工具调用
 */

import {
  ChatMessage,
  AISettings,
  AIResponse,
  AIError,
  AIErrorCode,
  ChatContext,
  RepositoryReference,
} from "@shared/types";
import type { AIProviderId, ProviderAccountConfig } from "@shared/types/ai-provider";
import { logger } from "@main/utils/logger";
import { generateText, tool } from "ai";
import { z } from "zod";
import { initializeTools, getToolRegistry } from "./tools";
import { LanceDBSearchService } from "@main/services/search/lancedb-search-service";
import { providerRegistry } from "./adapters/provider-registry";

export class AIService {
  private settings: AISettings | null = null;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();
  private searchService: LanceDBSearchService;
  private toolsInitialized = false;

  constructor() {
    this.searchService = new LanceDBSearchService();
  }

  /**
   * 初始化 AI 服务
   */
  async initialize(settings: AISettings): Promise<void> {
    try {
      if (!settings.enabled) {
        throw new AIError(AIErrorCode.NOT_CONFIGURED, "AI service not configured");
      }

      const account = this.toProviderAccountConfig(settings);
      const provider = providerRegistry.getProviderDefinitionOrThrow(account.providerId);

      if (provider.validation.apiKeyRequired && !account.apiKey) {
        throw new AIError(AIErrorCode.NOT_CONFIGURED, "AI service not configured");
      }

      if (provider.validation.baseUrlRequired && !account.baseUrl) {
        throw new AIError(AIErrorCode.NOT_CONFIGURED, "AI service not configured");
      }

      this.settings = settings;

      // 初始化工具系统
      if (!this.toolsInitialized) {
        await initializeTools(this.searchService);
        this.toolsInitialized = true;
      }

      logger.debug("AI service initialized with provider:", settings.provider);
    } catch (error) {
      logger.error("Failed to initialize AI service:", error);
      throw error;
    }
  }

  /**
   * 聊天方法
   */
  async chat(
    message: string,
    conversationId: string = "default",
    userId?: string
  ): Promise<AIResponse> {
    if (!this.settings) {
      throw new AIError(
        AIErrorCode.NOT_CONFIGURED,
        "AI service not initialized"
      );
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
        role: "user",
        content: message,
        timestamp: Date.now(),
      });

      this.addMessageToHistory(conversationId, {
        id: `msg_${Date.now() + 1}`,
        role: "assistant",
        content: response.content,
        timestamp: Date.now(),
        references: response.references,
      });

      return response;
    } catch (error) {
      logger.error("Chat failed:", error);
      if (error instanceof AIError) {
        throw error;
      }
      throw new AIError(
        AIErrorCode.LLM_ERROR,
        `Chat failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 调用 LLM 并处理工具调用
   */
  private async callLLMWithTools(
    message: string,
    context: ChatContext
  ): Promise<AIResponse> {
    if (!this.settings) {
      throw new AIError(AIErrorCode.NOT_CONFIGURED, "Settings not available");
    }

    try {
      // 获取模型实例
      const model = this.getModel();

      // 获取工具定义并转换为 AI SDK 格式
      const toolRegistry = getToolRegistry();
      const toolDefinitions = toolRegistry.getDefinitions();
      const tools = this.convertToolsToAISDKFormat(toolDefinitions);

      // 构建消息
      const systemPrompt = this.buildSystemPrompt();
      const messages = this.buildMessages(message, context);

      // 使用 generateText 进行对话（支持工具调用）
      const result = await generateText({
        model,
        system: systemPrompt,
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        tools,
        maxSteps: 5, // 允许多轮工具调用
        temperature: this.settings.temperature || 0.7,
        topP: this.settings.topP || 1.0,
      });

      // 收集仓库引用
      const allReferences: RepositoryReference[] = [];
      if (result.steps && result.steps.length > 0) {
        for (const step of result.steps) {
          if (step.toolResults && step.toolResults.length > 0) {
            for (const toolResult of step.toolResults) {
              if (
                toolResult.result &&
                typeof toolResult.result === "object"
              ) {
                const resultObj = toolResult.result as {
                  repositories?: RepositoryReference[];
                };
                if (
                  resultObj.repositories &&
                  Array.isArray(resultObj.repositories)
                ) {
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
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        },
      };
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      throw new AIError(
        AIErrorCode.LLM_ERROR,
        `Failed to call LLM: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 获取模型实例
   */
  private getModel() {
    if (!this.settings) {
      throw new AIError(AIErrorCode.NOT_CONFIGURED, "Settings not available");
    }

    const account = this.toProviderAccountConfig(this.settings);
    const provider = providerRegistry.getProviderDefinitionOrThrow(account.providerId);
    const adapter = providerRegistry.getAdapterForAccount(account);
    const modelId = this.settings.model?.trim() || undefined;
    return adapter.createLanguageModel({ provider, account, modelId });
  }

  /**
   * 将工具定义转换为 AI SDK 格式
   */
  private convertToolsToAISDKFormat(
    toolDefinitions: Array<{
      name: string;
      description: string;
      parameters: {
        type: "object";
        properties: Record<string, unknown>;
        required?: string[];
      };
    }>
  ) {
    const tools: Record<string, ReturnType<typeof tool>> = {};
    const toolRegistry = getToolRegistry();

    for (const toolDef of toolDefinitions) {
      // 将 JSON Schema 转换为 Zod schema
      const zodSchema = this.jsonSchemaToZod(toolDef.parameters);

      tools[toolDef.name] = tool({
        description: toolDef.description,
        parameters: zodSchema,
        execute: async (args: Record<string, unknown>) => {
          const result = await toolRegistry.execute({
            id: `tool_${Date.now()}`,
            name: toolDef.name,
            arguments: args,
          });

          if (result.error) {
            throw new Error(result.error);
          }

          return result.result;
        },
      });
    }

    return tools;
  }

  /**
   * 将 JSON Schema 转换为 Zod schema
   */
  private jsonSchemaToZod(
    schema: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    }
  ): z.ZodObject<Record<string, z.ZodTypeAny>> {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [key, value] of Object.entries(schema.properties)) {
      const prop = value as {
        type: string;
        description?: string;
        enum?: string[];
      };

      let zodType: z.ZodTypeAny;

      switch (prop.type) {
        case "string":
          zodType = prop.enum ? z.enum(prop.enum as [string, ...string[]]) : z.string();
          break;
        case "number":
          zodType = z.number();
          break;
        case "boolean":
          zodType = z.boolean();
          break;
        case "array":
          zodType = z.array(z.unknown());
          break;
        case "object":
          zodType = z.record(z.unknown());
          break;
        default:
          zodType = z.unknown();
      }

      if (prop.description) {
        zodType = zodType.describe(prop.description);
      }

      // 如果不在 required 列表中，则设为可选
      if (!schema.required?.includes(key)) {
        zodType = zodType.optional();
      }

      shape[key] = zodType;
    }

    return z.object(shape);
  }

  /**
   * 构建系统提示
   */
  private buildSystemPrompt(): string {
    return `你是一个 GitHub 仓库助手，专门帮助用户查找和理解优质的开源项目。

你可以使用以下工具来查询仓库信息：
- search_repositories: 搜索仓库（关键词匹配）
- filter_repositories: 按条件筛选仓库（语言、星数、时间等）
- get_repository_details: 获取仓库详情
- get_popular_repositories: 获取热门仓库
- get_repositories_by_topic: 按主题查询仓库

请根据用户的问题，智能选择合适的工具来获取信息，然后用中文给出清晰、有帮助的回答。

重要提示：
1. 当用户询问仓库信息时，主动使用工具查询
2. 在回答中引用具体的仓库信息
3. 提供仓库的关键信息（名称、描述、星数、语言等）
4. 如果查询结果为空，建议用户尝试其他关键词或条件`;
  }

  /**
   * 构建消息列表
   */
  private buildMessages(
    currentMessage: string,
    context: ChatContext
  ): Array<{ role: "user" | "assistant"; content: string }> {
    const messages: Array<{ role: "user" | "assistant"; content: string }> =
      [];

    // 添加对话历史（最近 10 条）
    const history = context.conversationHistory || [];
    const recentHistory = history.slice(-10);
    recentHistory.forEach((msg) => {
      if (msg.role !== "system") {
        messages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    });

    // 添加当前消息
    messages.push({
      role: "user",
      content: currentMessage,
    });

    return messages;
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
  private addMessageToHistory(
    conversationId: string,
    message: ChatMessage
  ): void {
    const history = this.conversationHistory.get(conversationId) || [];
    history.push(message);
    this.conversationHistory.set(conversationId, history);
  }

  /**
   * 清除对话历史
   */
  clearConversationHistory(conversationId: string): void {
    this.conversationHistory.delete(conversationId);
    logger.debug("Cleared conversation history for:", conversationId);
  }

  /**
   * 获取所有对话 ID
   */
  getConversationIds(): string[] {
    return Array.from(this.conversationHistory.keys());
  }

  /**
   * 测试 API 连接
   */
  async testConnection(settings: AISettings): Promise<boolean> {
    try {
      // 使用 AI SDK 进行简单的测试调用
      const model = this.getModelForSettings(settings);

      const result = await generateText({
        model,
        prompt: "ping",
      });

      logger.debug("Connection test successful:", result.text);
      return true;
    } catch (error) {
      logger.error("Connection test failed:", error);
      throw this.handleConnectionError(error);
    }
  }

  /**
   * 根据设置获取模型实例（用于测试连接）
   */
  private getModelForSettings(settings: AISettings) {
    const account = this.toProviderAccountConfig(settings);
    const provider = providerRegistry.getProviderDefinitionOrThrow(account.providerId);
    const adapter = providerRegistry.getAdapterForAccount(account);
    const modelId = settings.model?.trim() || undefined;
    return adapter.createLanguageModel({ provider, account, modelId });
  }

  private toProviderAccountConfig(settings: AISettings): ProviderAccountConfig {
    return {
      providerId: settings.provider as AIProviderId,
      baseUrl: settings.baseURL,
      apiKey: settings.apiKey?.trim() || undefined,
      timeout: 30000,
      retries: 3,
      strictTLS: true,
      defaultModel: settings.model,
      enabled: settings.enabled,
    };
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(error: unknown): AIError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes("401") || message.includes("unauthorized")) {
        return new AIError(AIErrorCode.INVALID_API_KEY, "Invalid API Key", 401);
      } else if (message.includes("429") || message.includes("rate limit")) {
        return new AIError(AIErrorCode.RATE_LIMITED, "Rate limited", 429);
      }

      return new AIError(
        AIErrorCode.LLM_ERROR,
        `Connection test failed: ${error.message}`
      );
    }

    return new AIError(
      AIErrorCode.LLM_ERROR,
      `Connection test failed: ${String(error)}`
    );
  }

  /**
   * 更新设置
   */
  async updateSettings(settings: Partial<AISettings>): Promise<void> {
    if (!this.settings) {
      throw new AIError(
        AIErrorCode.NOT_CONFIGURED,
        "AI service not initialized"
      );
    }

    this.settings = { ...this.settings, ...settings };
    logger.debug("AI service settings updated");
  }

  /**
   * 获取当前设置（不含 API Key）
   */
  getSettings(): AISettings | null {
    return this.settings;
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    this.conversationHistory.clear();
    logger.debug("AI service closed");
  }
}
