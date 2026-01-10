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
        if (!getAIService()) {
          return {
            success: false,
            error: "AI service not initialized",
          } as IPCResponse;
        }

        const response = await getAIService().chat(
          payload.message,
          payload.conversationId,
          payload.userId,
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
          conversationId: payload.conversationId || 'default',
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
              payload.message,
              payload.conversationId || 'default',
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
              payload.userId
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
        const session = activeSessions.get(sessionId);
        if (!session) {
          return {
            success: false,
            error: "Session not found",
          } as IPCResponse;
        }

        logger.debug(`[AI Handlers] Aborting stream session: ${sessionId}`);
        session.controller?.abort();
        session.status = 'aborted';
        activeSessions.delete(sessionId);

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
        await providerAccountService.saveAccount(config);
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
        const account = await providerAccountService.getAccount(providerId);
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
        await providerAccountService.deleteAccount(providerId);
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
        const result = await modelDiscoveryService.getModels(
          config,
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
        const result = await modelDiscoveryService.testConnection(config);
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

  logger.info("[AI Handlers] All handlers registered successfully");
}

// 导出单例管理函数供 IPC index 使用
export { setAIService, getAIService };
