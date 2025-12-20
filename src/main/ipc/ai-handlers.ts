/**
 * AI IPC 处理程序
 * 处理 Renderer 进程的 AI 相关请求
 */

import { ipcMain } from "electron";
import { AIService, setAIService, getAIService } from "@main/services/ai";
import { modelDiscoveryService } from "@main/services/ai/model-discovery-service";
import { providerAccountService } from "@main/services/ai/provider-account-service";
import { aiSettingsService } from "@main/services/ai/ai-settings-service";
import { IPC_CHANNELS } from "@shared/constants";
import { getProviderOptions } from "@shared/data/ai-providers";
import {
  AIResponse,
  AIChatPayload,
  AISettingsPayload,
  AITestConnectionPayload,
  AISafeSettings,
  AISettings,
  IPCResponse,
  ProviderAccountConfig,
} from "@shared/types";
import type { AIProviderId } from "@shared/types/ai-provider";
import { logger } from "@main/utils/logger";

/**
 * 初始化 AI IPC 处理程序
 */
export function initializeAIHandlers(): void {
  // 创建并设置 AI 服务实例
  const aiServiceInstance = new AIService();
  setAIService(aiServiceInstance);

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
        // 从持久化服务读取设置
        const settings = await aiSettingsService.getSettings();
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
        // 保存到持久化服务
        await aiSettingsService.updateSettings(payload as Partial<AISettings>);

        // 同步更新 AIService 内存中的设置
        if (getAIService()) {
          await getAIService().updateSettings(payload as Partial<AISettings>);
        }

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
        if (!getAIService()) {
          return {
            success: false,
            error: "AI service not initialized",
          } as IPCResponse;
        }

        const result = await getAIService().testConnection({
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
        if (!getAIService()) {
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
        if (!getAIService()) {
          return {
            success: false,
            error: "AI service not initialized",
          } as IPCResponse;
        }

        getAIService().clearConversationHistory(conversationId);

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

  // 获取 Provider 列表
  ipcMain.handle(
    IPC_CHANNELS.AI.GET_PROVIDER_LIST,
    async (_event) => {
      try {
        const providers = getProviderOptions();
        return {
          success: true,
          data: providers,
        } as IPCResponse<typeof providers>;
      } catch (error) {
        logger.error("Get provider list handler error:", error);
        return {
          success: false,
          error: "Failed to get provider list",
        } as IPCResponse;
      }
    }
  );

  // 获取模型列表
  ipcMain.handle(
    IPC_CHANNELS.AI.GET_MODEL_LIST,
    async (_event, config: ProviderAccountConfig, forceRefresh: boolean = false) => {
      try {
        await modelDiscoveryService.initialize();
        const modelList = await modelDiscoveryService.getModels(config, forceRefresh);

        return {
          success: true,
          data: modelList,
        } as IPCResponse<typeof modelList>;
      } catch (error) {
        logger.error("Get model list handler error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to get model list",
        } as IPCResponse;
      }
    }
  );

  // 清除模型缓存
  ipcMain.handle(
    IPC_CHANNELS.AI.CLEAR_MODEL_CACHE,
    async (_event, providerId?: AIProviderId) => {
      try {
        await modelDiscoveryService.initialize();
        await modelDiscoveryService.clearCache(providerId);

        return {
          success: true,
        } as IPCResponse;
      } catch (error) {
        logger.error("Clear model cache handler error:", error);
        return {
          success: false,
          error: "Failed to clear model cache",
        } as IPCResponse;
      }
    }
  );

  // 测试 Provider 连接
  ipcMain.handle(
    IPC_CHANNELS.AI.TEST_PROVIDER_CONNECTION,
    async (_event, config: ProviderAccountConfig) => {
      try {
        await modelDiscoveryService.initialize();
        const result = await modelDiscoveryService.testConnection(config);

        return {
          success: true,
          data: result,
        } as IPCResponse<typeof result>;
      } catch (error) {
        logger.error("Test provider connection handler error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Connection test failed",
        } as IPCResponse;
      }
    }
  );

  // 保存 Provider 账户配置
  ipcMain.handle(
    IPC_CHANNELS.AI.SAVE_PROVIDER_ACCOUNT,
    async (_event, config: ProviderAccountConfig) => {
      try {
        await providerAccountService.initialize();
        await providerAccountService.saveAccount(config);

        return {
          success: true,
        } as IPCResponse;
      } catch (error) {
        logger.error("Save provider account handler error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to save provider account",
        } as IPCResponse;
      }
    }
  );

  // 获取 Provider 账户配置
  ipcMain.handle(
    IPC_CHANNELS.AI.GET_PROVIDER_ACCOUNT,
    async (_event, providerId: AIProviderId) => {
      try {
        await providerAccountService.initialize();
        const account = await providerAccountService.getAccount(providerId);

        return {
          success: true,
          data: account,
        } as IPCResponse<ProviderAccountConfig | null>;
      } catch (error) {
        logger.error("Get provider account handler error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to get provider account",
        } as IPCResponse;
      }
    }
  );

  // 删除 Provider 账户配置
  ipcMain.handle(
    IPC_CHANNELS.AI.DELETE_PROVIDER_ACCOUNT,
    async (_event, providerId: AIProviderId) => {
      try {
        await providerAccountService.initialize();
        await providerAccountService.deleteAccount(providerId);

        return {
          success: true,
        } as IPCResponse;
      } catch (error) {
        logger.error("Delete provider account handler error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to delete provider account",
        } as IPCResponse;
      }
    }
  );

  // 列出所有 Provider 账户
  ipcMain.handle(
    IPC_CHANNELS.AI.LIST_PROVIDER_ACCOUNTS,
    async (_event) => {
      try {
        await providerAccountService.initialize();
        const accounts = await providerAccountService.listAccounts();

        return {
          success: true,
          data: accounts,
        } as IPCResponse<typeof accounts>;
      } catch (error) {
        logger.error("List provider accounts handler error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Failed to list provider accounts",
        } as IPCResponse;
      }
    }
  );

  logger.debug("AI IPC handlers initialized");
}

// 重新导出 setAIService 以保持向后兼容
export { setAIService } from "@main/services/ai";
