/**
 * AI 服务
 * 核心 AI 对话功能，集成 LLM 和 Embedding
 */

import { EmbeddingService } from "./embedding-service";
import { VectorSearchService } from "./vector-search-service";
import {
  ChatMessage,
  ChatRole,
  AISettings,
  AIResponse,
  AIError,
  AIErrorCode,
  ChatContext,
} from "@shared/types";
import { logger } from "@main/utils/logger";

export class AIService {
  private embeddingService: EmbeddingService | null = null;
  private vectorSearchService: VectorSearchService | null = null;
  private settings: AISettings | null = null;
  private conversationHistory: Map<string, ChatMessage[]> = new Map();

  /**
   * 初始化 AI 服务
   */
  async initialize(settings: AISettings): Promise<void> {
    try {
      if (!settings.enabled || !settings.apiKey) {
        throw new AIError(
          AIErrorCode.NOT_CONFIGURED,
          "AI service not configured"
        );
      }

      this.settings = settings;

      // 初始化 Embedding 服务
      this.embeddingService = new EmbeddingService({
        apiKey: settings.apiKey,
        provider: settings.provider,
        model: settings.embeddingModel || "text-embedding-3-small",
      });

      // 初始化向量搜索服务
      this.vectorSearchService = new VectorSearchService({
        topK: 5,
      });
      await this.vectorSearchService.initialize();

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
    if (!this.settings || !this.embeddingService || !this.vectorSearchService) {
      throw new AIError(
        AIErrorCode.NOT_CONFIGURED,
        "AI service not initialized"
      );
    }

    try {
      // 生成输入的 Embedding
      const embedding = await this.embeddingService.embed(message);

      // 执行向量搜索获取相关仓库
      const searchResults = await this.vectorSearchService.hybridSearch(
        embedding,
        message
      );

      // 构建上下文
      const context: ChatContext = {
        conversationHistory: this.getConversationHistory(conversationId),
        searchResults: {
          repositories: searchResults,
          totalTime: 0,
        },
        userId,
      };

      // 调用 LLM
      const response = await this.callLLM(message, context);

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
        references: searchResults,
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
   * 调用 LLM
   */
  private async callLLM(message: string, context: ChatContext): Promise<AIResponse> {
    if (!this.settings) {
      throw new AIError(AIErrorCode.NOT_CONFIGURED, "Settings not available");
    }

    const provider = this.settings.provider;

    if (provider === "openai") {
      return this.callOpenAILLM(message, context);
    } else if (provider === "anthropic") {
      return this.callAnthropicLLM(message, context);
    } else if (provider === "deepseek") {
      return this.callDeepSeekLLM(message, context);
    } else if (provider === "ollama") {
      return this.callOllamaLLM(message, context);
    } else {
      throw new AIError(
        AIErrorCode.CONFIGURATION_ERROR,
        `Unsupported provider: ${provider}`
      );
    }
  }

  /**
   * 调用 OpenAI LLM
   */
  private async callOpenAILLM(
    message: string,
    context: ChatContext
  ): Promise<AIResponse> {
    if (!this.settings) {
      throw new AIError(AIErrorCode.NOT_CONFIGURED, "Settings not available");
    }

    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const messages = this.buildMessages(message, context);

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.settings.apiKey}`,
        },
        body: JSON.stringify({
          model: this.settings.model || "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          max_tokens: this.settings.maxTokens || 1024,
          temperature: this.settings.temperature || 0.7,
          top_p: this.settings.topP || 1.0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message || "Unknown error";

        if (response.status === 401) {
          throw new AIError(AIErrorCode.INVALID_API_KEY, "Invalid API Key", 401);
        } else if (response.status === 429) {
          throw new AIError(AIErrorCode.RATE_LIMITED, "Rate limited", 429);
        }

        throw new AIError(
          AIErrorCode.LLM_ERROR,
          `OpenAI API error: ${errorMessage}`,
          response.status,
          errorData
        );
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || "";

      return {
        content,
        references: context.searchResults?.repositories || [],
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      throw new AIError(
        AIErrorCode.LLM_ERROR,
        `Failed to call OpenAI: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 调用 Anthropic LLM
   */
  private async callAnthropicLLM(
    _message: string,
    _context: ChatContext
  ): Promise<AIResponse> {
    // TODO: 实现 Anthropic 调用
    logger.warn("Anthropic LLM not yet implemented");
    throw new AIError(
      AIErrorCode.CONFIGURATION_ERROR,
      "Anthropic LLM not yet implemented"
    );
  }

  /**
   * 调用 DeepSeek LLM
   */
  private async callDeepSeekLLM(
    _message: string,
    _context: ChatContext
  ): Promise<AIResponse> {
    // TODO: 实现 DeepSeek 调用
    logger.warn("DeepSeek LLM not yet implemented");
    throw new AIError(
      AIErrorCode.CONFIGURATION_ERROR,
      "DeepSeek LLM not yet implemented"
    );
  }

  /**
   * 调用 Ollama LLM（本地）
   */
  private async callOllamaLLM(
    _message: string,
    _context: ChatContext
  ): Promise<AIResponse> {
    // TODO: 实现 Ollama 调用
    logger.warn("Ollama LLM not yet implemented");
    throw new AIError(
      AIErrorCode.CONFIGURATION_ERROR,
      "Ollama LLM not yet implemented"
    );
  }

  /**
   * 构建系统提示
   */
  private buildSystemPrompt(context: ChatContext): string {
    const repositories = context.searchResults?.repositories || [];

    let prompt = `你是一个 GitHub 仓库助手，专门帮助用户查找和理解优质的开源项目。

使用用户提供的仓库信息来回答问题和提供建议。如果有相关的仓库，请在回答中提及。`;

    if (repositories.length > 0) {
      prompt += "\n\n相关的仓库信息：\n";
      repositories.forEach((repo, index) => {
        prompt += `
${index + 1}. ${repo.repositoryName} (${repo.owner})
   描述: ${repo.description || "无"}
   星数: ${repo.stars || 0}
   语言: ${repo.language || "未知"}
   链接: ${repo.url}`;
      });
    }

    prompt += "\n\n请用中文回答用户的问题，并在适当时引用上述仓库。";
    return prompt;
  }

  /**
   * 构建消息列表
   */
  private buildMessages(
    currentMessage: string,
    context: ChatContext
  ): Array<{ role: ChatRole; content: string }> {
    const messages: Array<{ role: ChatRole; content: string }> = [];

    // 添加对话历史（最近 10 条）
    const history = context.conversationHistory || [];
    const recentHistory = history.slice(-10);
    recentHistory.forEach((msg) => {
      if (msg.role !== "system") {
        messages.push({
          role: msg.role as ChatRole,
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
  private addMessageToHistory(conversationId: string, message: ChatMessage): void {
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
      if (settings.provider === "openai") {
        return await this.testOpenAIConnection(settings);
      } else if (settings.provider === "anthropic") {
        // TODO: 实现 Anthropic 连接测试
        return true;
      }
      return false;
    } catch (error) {
      logger.error("Connection test failed:", error);
      throw error;
    }
  }

  /**
   * 测试 OpenAI 连接
   */
  private async testOpenAIConnection(settings: AISettings): Promise<boolean> {
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
        },
      });

      if (response.ok) {
        logger.debug("OpenAI connection test successful");
        return true;
      } else if (response.status === 401) {
        throw new AIError(AIErrorCode.INVALID_API_KEY, "Invalid API Key");
      } else {
        throw new AIError(
          AIErrorCode.LLM_ERROR,
          `OpenAI connection test failed: ${response.status}`
        );
      }
    } catch (error) {
      logger.error("OpenAI connection test failed:", error);
      throw error;
    }
  }

  /**
   * 更新设置
   */
  async updateSettings(settings: Partial<AISettings>): Promise<void> {
    if (!this.settings) {
      throw new AIError(AIErrorCode.NOT_CONFIGURED, "AI service not initialized");
    }

    this.settings = { ...this.settings, ...settings };

    // 重新初始化 Embedding 服务
    if (
      settings.apiKey ||
      settings.provider ||
      settings.embeddingModel
    ) {
      if (this.embeddingService) {
        this.embeddingService.updateConfig({
          apiKey: this.settings.apiKey,
          provider: this.settings.provider,
          model: this.settings.embeddingModel || "text-embedding-3-small",
        });
      }
    }

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
    if (this.vectorSearchService) {
      await this.vectorSearchService.close();
    }
    this.embeddingService = null;
    this.vectorSearchService = null;
    this.conversationHistory.clear();
    logger.debug("AI service closed");
  }
}
