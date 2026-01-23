/**
 * AI IPC 处理程序
 * 使用新架构的 AIService
 */

import { ipcMain } from "electron";
import { AIService, setAIService, getAIService } from "@main/services/ai";
import { modelDiscoveryService } from "@main/services/ai/discovery/model-discovery-service";
import { providerAccountService } from "@main/services/ai/storage/provider-account-service";
import { IPC_CHANNELS } from "@shared/constants";
import { getProviderOptions } from "@shared/data/ai-providers";
import {
  AIResponse,
  AIChatPayload,
  IPCResponse,
  ProviderAccountConfig,
  StreamSessionInfo,
  StreamChunk,
} from "@shared/types";
import type { AIProviderId } from "@shared/types/ai-provider";
import { logger } from "@main/utils/logger";
import { randomUUID } from "crypto";
import {
  AIChatPayloadSchema,
  SessionIdSchema,
  ProviderIdSchema,
  GenerateTitlePayloadSchema,
  SaveConversationMetaPayloadSchema,
  ConversationIdSchema,
} from "./schemas";
import { ProviderAccountConfigSchema } from "@shared/types/ai-provider";

// 活跃的流式会话管理
const activeSessions = new Map<string, StreamSessionInfo>();

// 会话超时清理（5 分钟）
const SESSION_TIMEOUT = 5 * 60 * 1000;

// 定期清理超时会话
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.lastUpdateTime > SESSION_TIMEOUT) {
      logger.debug(`[AI Handlers] Cleaning up timeout session: ${sessionId}`);
      session.controller?.abort();
      activeSessions.delete(sessionId);
    }
  }
}, 60000); // 每分钟检查一次

/**
 * 初始化 AI IPC 处理程序
 */
export function initializeAIHandlers(): void {
  // 如果尚未设置 AI 服务实例，则创建一个新的
  if (!getAIService()) {
    const aiServiceInstance = new AIService();
    setAIService(aiServiceInstance);
  }

  logger.info("[AI Handlers] Initializing with new architecture");

  // 聊天处理
  ipcMain.handle(
    IPC_CHANNELS.AI.CHAT,
    async (_event, payload: AIChatPayload) => {
      try {
        // 运行时校验
        const validatedPayload = AIChatPayloadSchema.parse(payload);

        if (!getAIService()) {
          return {
            success: false,
            error: "AI service not initialized",
          } as IPCResponse;
        }

        const response = await getAIService().chat(
          validatedPayload.message,
          validatedPayload.conversationId,
          validatedPayload.userId,
        );

        return {
          success: true,
          data: response,
        } as IPCResponse<AIResponse>;
      } catch (error) {
        logger.error("[AI Handlers] Chat error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as IPCResponse;
      }
    },
  );

  // 流式聊天处理
  ipcMain.handle(
    IPC_CHANNELS.AI.CHAT_STREAM,
    async (event, payload: AIChatPayload) => {
      try {
        // 运行时校验
        const validatedPayload = AIChatPayloadSchema.parse(payload);

        if (!getAIService()) {
          return {
            success: false,
            error: "AI service not initialized",
          } as IPCResponse;
        }

        // 生成会话 ID
        const sessionId = randomUUID();
        const controller = new AbortController();

        // 创建会话信息
        const sessionInfo: StreamSessionInfo = {
          id: sessionId,
          conversationId: validatedPayload.conversationId || 'default',
          status: 'active',
          startTime: Date.now(),
          lastUpdateTime: Date.now(),
          controller,
        };

        activeSessions.set(sessionId, sessionInfo);
        logger.debug(`[AI Handlers] Created stream session: ${sessionId}`);

        // 异步执行流式聊天
        (async () => {
          try {
            await getAIService().streamChat(
              validatedPayload.message,
              validatedPayload.conversationId || 'default',
              (chunk: StreamChunk) => {
                // 更新会话时间
                sessionInfo.lastUpdateTime = Date.now();

                // 推送 chunk 到渲染进程
                event.sender.send(IPC_CHANNELS.AI.CHAT_STREAM_CHUNK, {
                  sessionId,
                  ...chunk,
                });
              },
              controller.signal,
              validatedPayload.userId
            );

            // 流式完成
            sessionInfo.status = 'completed';
            logger.debug(`[AI Handlers] Stream completed: ${sessionId}`);
          } catch (error) {
            // 流式错误
            sessionInfo.status = 'error';
            logger.error(`[AI Handlers] Stream error: ${sessionId}`, error);

            event.sender.send(IPC_CHANNELS.AI.CHAT_STREAM_CHUNK, {
              sessionId,
              type: 'error',
              content: '',
              error: error instanceof Error ? error.message : String(error),
            });
          } finally {
            // 清理会话
            activeSessions.delete(sessionId);
          }
        })();

        // 立即返回会话 ID
        return {
          success: true,
          data: { sessionId },
        } as IPCResponse<{ sessionId: string }>;
      } catch (error) {
        logger.error("[AI Handlers] Stream chat error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as IPCResponse;
      }
    },
  );

  // 中断流式聊天
  ipcMain.handle(
    IPC_CHANNELS.AI.CHAT_ABORT,
    async (_event, sessionId: string) => {
      try {
        // 运行时校验
        const validatedSessionId = SessionIdSchema.parse(sessionId);

        const session = activeSessions.get(validatedSessionId);
        if (!session) {
          return {
            success: false,
            error: "Session not found",
          } as IPCResponse;
        }

        logger.debug(`[AI Handlers] Aborting stream session: ${validatedSessionId}`);
        session.controller?.abort();
        session.status = 'aborted';
        activeSessions.delete(validatedSessionId);

        return {
          success: true,
        } as IPCResponse;
      } catch (error) {
        logger.error("[AI Handlers] Abort stream error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as IPCResponse;
      }
    },
  );

  // 获取 Provider 选项
  ipcMain.handle(IPC_CHANNELS.AI.GET_PROVIDER_OPTIONS, async () => {
    try {
      const options = getProviderOptions();
      return {
        success: true,
        data: options,
      } as IPCResponse;
    } catch (error) {
      logger.error("[AI Handlers] Get provider options error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // 获取 Provider 列表
  ipcMain.handle(IPC_CHANNELS.AI.GET_PROVIDER_LIST, async () => {
    try {
      const options = getProviderOptions();
      return {
        success: true,
        data: options,
      } as IPCResponse;
    } catch (error) {
      logger.error("[AI Handlers] Get provider list error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // 列出所有 Provider 账户
  ipcMain.handle(IPC_CHANNELS.AI.LIST_PROVIDER_ACCOUNTS, async () => {
    try {
      const accounts = await providerAccountService.listAccounts();
      return {
        success: true,
        data: accounts,
      } as IPCResponse;
    } catch (error) {
      logger.error("[AI Handlers] List provider accounts error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // 保存 Provider 账户
  ipcMain.handle(
    IPC_CHANNELS.AI.SAVE_PROVIDER_ACCOUNT,
    async (_event, config: ProviderAccountConfig) => {
      try {
        // 运行时校验
        const validatedConfig = ProviderAccountConfigSchema.parse(config);

        await providerAccountService.saveAccount(validatedConfig);
        return {
          success: true,
        } as IPCResponse;
      } catch (error) {
        logger.error("[AI Handlers] Save provider account error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as IPCResponse;
      }
    },
  );

  // 获取 Provider 账户
  ipcMain.handle(
    IPC_CHANNELS.AI.GET_PROVIDER_ACCOUNT,
    async (_event, providerId: AIProviderId) => {
      try {
        // 运行时校验
        const validatedProviderId = ProviderIdSchema.parse(providerId);

        const account = await providerAccountService.getAccount(validatedProviderId);
        return {
          success: true,
          data: account,
        } as IPCResponse;
      } catch (error) {
        logger.error("[AI Handlers] Get provider account error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as IPCResponse;
      }
    },
  );

  // 删除 Provider 账户
  ipcMain.handle(
    IPC_CHANNELS.AI.DELETE_PROVIDER_ACCOUNT,
    async (_event, providerId: AIProviderId) => {
      try {
        // 运行时校验
        const validatedProviderId = ProviderIdSchema.parse(providerId);

        await providerAccountService.deleteAccount(validatedProviderId);
        return {
          success: true,
        } as IPCResponse;
      } catch (error) {
        logger.error("[AI Handlers] Delete provider account error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as IPCResponse;
      }
    },
  );

  // 获取模型列表
  ipcMain.handle(
    IPC_CHANNELS.AI.GET_MODEL_LIST,
    async (
      _event,
      config: ProviderAccountConfig,
      forceRefresh: boolean = false,
    ) => {
      try {
        // 运行时校验
        const validatedConfig = ProviderAccountConfigSchema.parse(config);

        const result = await modelDiscoveryService.getModels(
          validatedConfig,
          forceRefresh,
        );
        return {
          success: true,
          data: result,
        } as IPCResponse;
      } catch (error) {
        logger.error("[AI Handlers] Get model list error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as IPCResponse;
      }
    },
  );

  // 测试 Provider 连接
  ipcMain.handle(
    IPC_CHANNELS.AI.TEST_PROVIDER_CONNECTION,
    async (_event, config: ProviderAccountConfig) => {
      try {
        // 运行时校验
        const validatedConfig = ProviderAccountConfigSchema.parse(config);

        const result = await modelDiscoveryService.testConnection(validatedConfig);
        return {
          success: true,
          data: result,
        } as IPCResponse;
      } catch (error) {
        logger.error("[AI Handlers] Test provider connection error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as IPCResponse;
      }
    },
  );

  // 获取服务统计信息（新功能）
  ipcMain.handle(IPC_CHANNELS.AI.GET_STATS, async () => {
    try {
      const stats = getAIService().stats;
      return {
        success: true,
        data: stats,
      } as IPCResponse;
    } catch (error) {
      logger.error("[AI Handlers] Get stats error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // ========== 会话管理相关 ==========

  // 生成对话标题
  ipcMain.handle(
    IPC_CHANNELS.AI.GENERATE_TITLE,
    async (_event, payload: {
      conversationId: string;
      firstUserMessage: string;
      firstAssistantMessage?: string;
      tempTitle: string;
      modelId?: string;
    }) => {
      // 运行时校验（在 try 外面，这样 catch 也能访问）
      let validatedPayload;
      try {
        validatedPayload = GenerateTitlePayloadSchema.parse(payload);
      } catch (error) {
        logger.error("[AI Handlers] Invalid generate title payload:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as IPCResponse;
      }

      try {
        const { conversationMetadataService } = await import('@main/services/conversations');

        // 确保服务已初始化
        await conversationMetadataService.initialize();

        // 创建或获取会话元数据
        await conversationMetadataService.createOrGet(
          validatedPayload.conversationId,
          validatedPayload.tempTitle
        );

        // 调用 AI 生成标题
        const result = await getAIService().generateTitle(validatedPayload);

        // 更新元数据
        const meta = await conversationMetadataService.updateTitle(
          validatedPayload.conversationId,
          result.title,
          'ready'
        );

        return {
          success: true,
          data: {
            conversationId: meta.id,
            title: meta.title,
            status: meta.status,
          },
        } as IPCResponse;
      } catch (error) {
        logger.error("[AI Handlers] Generate title error:", error);

        // 失败时保存临时标题
        try {
          const { conversationMetadataService } = await import('@main/services/conversations');
          await conversationMetadataService.updateTitle(
            validatedPayload.conversationId,
            validatedPayload.tempTitle,
            'failed',
            error instanceof Error ? error.message : String(error)
          );
        } catch (updateError) {
          logger.error("[AI Handlers] Failed to update title after error:", updateError);
        }

        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as IPCResponse;
      }
    }
  );

  // 获取所有会话列表
  ipcMain.handle(IPC_CHANNELS.AI.GET_CONVERSATIONS, async () => {
    try {
      const { conversationMetadataService } = await import('@main/services/conversations');
      await conversationMetadataService.initialize();

      const conversations = await conversationMetadataService.list();

      return {
        success: true,
        data: { conversations },
      } as IPCResponse;
    } catch (error) {
      logger.error("[AI Handlers] Get conversations error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // 保存会话元数据
  ipcMain.handle(
    IPC_CHANNELS.AI.SAVE_CONVERSATION_META,
    async (_event, payload: { conversationId: string; tempTitle: string }) => {
      try {
        // 运行时校验
        const validatedPayload = SaveConversationMetaPayloadSchema.parse(payload);

        const { conversationMetadataService } = await import('@main/services/conversations');
        await conversationMetadataService.initialize();

        const meta = await conversationMetadataService.createOrGet(
          validatedPayload.conversationId,
          validatedPayload.tempTitle
        );

        return {
          success: true,
          data: meta,
        } as IPCResponse;
      } catch (error) {
        logger.error("[AI Handlers] Save conversation meta error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as IPCResponse;
      }
    }
  );

  // 删除会话
  ipcMain.handle(
    IPC_CHANNELS.AI.DELETE_CONVERSATION,
    async (_event, conversationId: string) => {
      try {
        // 运行时校验
        const validatedConversationId = ConversationIdSchema.parse(conversationId);

        const { conversationMetadataService } = await import('@main/services/conversations');
        await conversationMetadataService.initialize();

        await conversationMetadataService.delete(validatedConversationId);

        return {
          success: true,
          data: { conversationId: validatedConversationId },
        } as IPCResponse;
      } catch (error) {
        logger.error("[AI Handlers] Delete conversation error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as IPCResponse;
      }
    }
  );

  logger.info("[AI Handlers] All handlers registered successfully");
}

// 导出单例管理函数供 IPC index 使用
export { setAIService, getAIService };
