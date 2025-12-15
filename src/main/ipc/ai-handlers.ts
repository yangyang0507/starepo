/**
 * AI IPC 处理程序
 * 处理 Renderer 进程的 AI 相关请求
 */

import { ipcMain } from "electron";
import { AIService } from "@main/services/ai";
import { IPC_CHANNELS } from "@shared/constants/ipc-channels";
import {
  AIResponse,
  AIChatPayload,
  AISettingsPayload,
  AITestConnectionPayload,
  AISafeSettings,
  AISettings,
  IPCResponse,
} from "@shared/types";
import { logger } from "@main/utils/logger";

let aiService: AIService | null = null;

/**
 * 初始化 AI IPC 处理程序
 */
export function initializeAIHandlers(): void {
  // 聊天处理
  ipcMain.handle(
    IPC_CHANNELS.AI.CHAT,
    async (_event, payload: AIChatPayload) => {
      try {
        if (!aiService) {
          return {
            success: false,
            error: "AI service not initialized",
          } as IPCResponse;
        }

        const response = await aiService.chat(
          payload.message,
          payload.conversationId,
          payload.userId
        );

        return {
          success: true,
          data: response,
        } as IPCResponse<AIResponse>;
      } catch (error) {
        logger.error("AI chat handler error:", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to process chat",
        } as IPCResponse;
      }
    }
  );

  // 获取 AI 设置
  ipcMain.handle(
    IPC_CHANNELS.AI.GET_SAFE_SETTINGS,
    async (_event) => {
      try {
        if (!aiService) {
          return {
            success: false,
            error: "AI service not initialized",
          } as IPCResponse;
        }

        const settings = aiService.getSettings();
        const safeSettings: AISafeSettings | null = settings
          ? {
              enabled: settings.enabled,
              provider: settings.provider,
              model: settings.model,
              maxTokens: settings.maxTokens,
              temperature: settings.temperature,
              topP: settings.topP,
              configured: true,
            }
          : null;

        return {
          success: true,
          data: safeSettings,
        } as IPCResponse<AISafeSettings>;
      } catch (error) {
        logger.error("Get AI settings handler error:", error);
        return {
          success: false,
          error: "Failed to get AI settings",
        } as IPCResponse;
      }
    }
  );

  // 设置 AI 配置
  ipcMain.handle(
    IPC_CHANNELS.AI.SET_SETTINGS,
    async (_event, payload: AISettingsPayload) => {
      try {
        if (!aiService) {
          return {
            success: false,
            error: "AI service not initialized",
          } as IPCResponse;
        }

        await aiService.updateSettings(payload as Partial<AISettings>);

        return {
          success: true,
        } as IPCResponse;
      } catch (error) {
        logger.error("Set AI settings handler error:", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to set AI settings",
        } as IPCResponse;
      }
    }
  );

  // 测试连接
  ipcMain.handle(
    IPC_CHANNELS.AI.TEST_CONNECTION,
    async (_event, payload: AITestConnectionPayload) => {
      try {
        if (!aiService) {
          return {
            success: false,
            error: "AI service not initialized",
          } as IPCResponse;
        }

        const result = await aiService.testConnection({
          enabled: true,
          provider: payload.provider,
          apiKey: payload.apiKey,
          model: payload.model,
        });

        return {
          success: result,
          data: result,
        } as IPCResponse<boolean>;
      } catch (error) {
        logger.error("Test connection handler error:", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Connection test failed",
        } as IPCResponse;
      }
    }
  );

  // 获取对话历史
  ipcMain.handle(
    IPC_CHANNELS.AI.GET_CHAT_HISTORY,
    async (_event, _conversationId: string) => {
      try {
        if (!aiService) {
          return {
            success: false,
            error: "AI service not initialized",
          } as IPCResponse;
        }

        // TODO: 实现获取对话历史
        return {
          success: true,
          data: [],
        } as IPCResponse;
      } catch (error) {
        logger.error("Get chat history handler error:", error);
        return {
          success: false,
          error: "Failed to get chat history",
        } as IPCResponse;
      }
    }
  );

  // 清除对话历史
  ipcMain.handle(
    IPC_CHANNELS.AI.CLEAR_CHAT_HISTORY,
    async (_event, conversationId: string) => {
      try {
        if (!aiService) {
          return {
            success: false,
            error: "AI service not initialized",
          } as IPCResponse;
        }

        aiService.clearConversationHistory(conversationId);

        return {
          success: true,
        } as IPCResponse;
      } catch (error) {
        logger.error("Clear chat history handler error:", error);
        return {
          success: false,
          error: "Failed to clear chat history",
        } as IPCResponse;
      }
    }
  );

  logger.debug("AI IPC handlers initialized");
}

/**
 * 设置 AI 服务实例
 */
export function setAIService(service: AIService | null): void {
  aiService = service;
}

/**
 * 获取 AI 服务实例
 */
export function getAIService(): AIService | null {
  return aiService;
}
