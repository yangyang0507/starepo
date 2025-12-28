/**
 * AI IPC 处理程序
 * 使用新架构的 AIService
 */

import { ipcMain } from 'electron';
import { AIService, setAIService, getAIService } from '@main/services/ai';
import { modelDiscoveryService } from '@main/services/ai/discovery/model-discovery-service';
import { providerAccountService } from '@main/services/ai/storage/provider-account-service';
import { aiSettingsService } from '@main/services/ai/ai-settings-service';
import { IPC_CHANNELS } from '@shared/constants';
import { getProviderOptions } from '@shared/data/ai-providers';
import {
  AIResponse,
  AIChatPayload,
  AISettingsPayload,
  AITestConnectionPayload,
  AISafeSettings,
  AISettings,
  IPCResponse,
  ProviderAccountConfig,
} from '@shared/types';
import type { AIProviderId } from '@shared/types/ai-provider';
import { logger } from '@main/utils/logger';

/**
 * 初始化 AI IPC 处理程序
 */
export function initializeAIHandlers(): void {
  // 如果尚未设置 AI 服务实例，则创建一个新的
  if (!getAIService()) {
    const aiServiceInstance = new AIService();
    setAIService(aiServiceInstance);
  }

  logger.info('[AI Handlers] Initializing with new architecture');

  // 聊天处理
  ipcMain.handle(IPC_CHANNELS.AI.CHAT, async (_event, payload: AIChatPayload) => {
    try {
      if (!getAIService()) {
        return {
          success: false,
          error: 'AI service not initialized',
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
      logger.error('[AI Handlers] Chat error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // 流式聊天处理
  ipcMain.handle(IPC_CHANNELS.AI.CHAT_STREAM, async (event, payload: AIChatPayload) => {
    try {
      if (!getAIService()) {
        return {
          success: false,
          error: 'AI service not initialized',
        } as IPCResponse;
      }

      // 注意：流式聊天需要在 AIServiceV2 中实现
      // 目前使用普通聊天作为回退
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
      logger.error('[AI Handlers] Stream chat error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // 初始化 AI 服务
  ipcMain.handle(IPC_CHANNELS.AI.INITIALIZE, async (_event, payload: AISettingsPayload) => {
    try {
      const settings = payload as Partial<AISettings>;
      await aiSettingsService.updateSettings(settings);

      const fullSettings = await aiSettingsService.getSettings();

      if (!fullSettings) {
        throw new Error('Failed to load settings after update');
      }

      await getAIService().initialize(fullSettings);

      logger.info('[AI Handlers] AI service initialized successfully');

      return {
        success: true,
        data: { initialized: true },
      } as IPCResponse;
    } catch (error) {
      logger.error('[AI Handlers] Initialize error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // 测试连接
  ipcMain.handle(
    IPC_CHANNELS.AI.TEST_CONNECTION,
    async (_event, payload: AITestConnectionPayload) => {
      try {
        // 测试连接逻辑保持不变
        const { provider, apiKey, model } = payload;

        const account: ProviderAccountConfig = {
          providerId: provider as AIProviderId,
          apiKey,
          baseUrl: undefined,
          defaultModel: model,
          timeout: 30000,
          retries: 3,
          strictTLS: true,
          enabled: true,
        };

        // 使用模型发现服务测试连接
        const result = await modelDiscoveryService.testConnection(account);

        return {
          success: result.success,
          data: result,
        } as IPCResponse;
      } catch (error) {
        logger.error('[AI Handlers] Test connection error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        } as IPCResponse;
      }
    }
  );

  // 获取设置
  ipcMain.handle(IPC_CHANNELS.AI.GET_SETTINGS, async () => {
    try {
      const settings = await aiSettingsService.getSettings();

      if (!settings) {
        return {
          success: false,
          error: 'Settings not found',
        } as IPCResponse;
      }

      const safeSettings: AISafeSettings = {
        enabled: settings.enabled,
        provider: settings.provider,
        model: settings.model,
        baseURL: settings.baseURL,
        temperature: settings.temperature,
        topP: settings.topP,
        configured: !!settings.apiKey,
      };

      return {
        success: true,
        data: safeSettings,
      } as IPCResponse<AISafeSettings>;
    } catch (error) {
      logger.error('[AI Handlers] Get settings error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // 获取安全的 AI 设置（不包含敏感信息）
  ipcMain.handle(IPC_CHANNELS.AI.GET_SAFE_SETTINGS, async () => {
    try {
      const settings = await aiSettingsService.getSettings();

      // 返回安全的设置（移除敏感信息）
      const safeSettings: AISafeSettings = {
        provider: settings.provider,
        model: settings.model,
        enabled: settings.enabled,
        maxTokens: settings.maxTokens,
        temperature: settings.temperature,
        topP: settings.topP,
      };

      return {
        success: true,
        data: safeSettings,
      } as IPCResponse<AISafeSettings>;
    } catch (error) {
      logger.error('[AI Handlers] Get safe settings error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // 设置 AI 配置
  ipcMain.handle(IPC_CHANNELS.AI.SET_SETTINGS, async (_event, payload: AISettingsPayload) => {
    try {
      const settings = payload as Partial<AISettings>;
      await aiSettingsService.updateSettings(settings);

      return {
        success: true,
      } as IPCResponse;
    } catch (error) {
      logger.error('[AI Handlers] Set settings error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // 获取 Provider 选项
  ipcMain.handle(IPC_CHANNELS.AI.GET_PROVIDER_OPTIONS, async () => {
    try {
      const options = getProviderOptions();
      return {
        success: true,
        data: options,
      } as IPCResponse;
    } catch (error) {
      logger.error('[AI Handlers] Get provider options error:', error);
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
      logger.error('[AI Handlers] Get provider list error:', error);
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
      logger.error('[AI Handlers] List provider accounts error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // 保存 Provider 账户
  ipcMain.handle(IPC_CHANNELS.AI.SAVE_PROVIDER_ACCOUNT, async (_event, config: ProviderAccountConfig) => {
    try {
      await providerAccountService.saveAccount(config);
      return {
        success: true,
      } as IPCResponse;
    } catch (error) {
      logger.error('[AI Handlers] Save provider account error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // 获取 Provider 账户
  ipcMain.handle(IPC_CHANNELS.AI.GET_PROVIDER_ACCOUNT, async (_event, providerId: AIProviderId) => {
    try {
      const account = await providerAccountService.getAccount(providerId);
      return {
        success: true,
        data: account,
      } as IPCResponse;
    } catch (error) {
      logger.error('[AI Handlers] Get provider account error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // 删除 Provider 账户
  ipcMain.handle(IPC_CHANNELS.AI.DELETE_PROVIDER_ACCOUNT, async (_event, providerId: AIProviderId) => {
    try {
      await providerAccountService.deleteAccount(providerId);
      return {
        success: true,
      } as IPCResponse;
    } catch (error) {
      logger.error('[AI Handlers] Delete provider account error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // 获取模型列表
  ipcMain.handle(IPC_CHANNELS.AI.GET_MODEL_LIST, async (_event, config: ProviderAccountConfig, forceRefresh: boolean = false) => {
    try {
      const result = await modelDiscoveryService.getModels(config, forceRefresh);
      return {
        success: true,
        data: result,
      } as IPCResponse;
    } catch (error) {
      logger.error('[AI Handlers] Get model list error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // 测试 Provider 连接
  ipcMain.handle(IPC_CHANNELS.AI.TEST_PROVIDER_CONNECTION, async (_event, config: ProviderAccountConfig) => {
    try {
      const result = await modelDiscoveryService.testConnection(config);
      return {
        success: true,
        data: result,
      } as IPCResponse;
    } catch (error) {
      logger.error('[AI Handlers] Test provider connection error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  // 获取服务统计信息（新功能）
  ipcMain.handle(IPC_CHANNELS.AI.GET_STATS, async () => {
    try {
      const stats = getAIService().stats;
      return {
        success: true,
        data: stats,
      } as IPCResponse;
    } catch (error) {
      logger.error('[AI Handlers] Get stats error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as IPCResponse;
    }
  });

  logger.info('[AI Handlers] All handlers registered successfully');
}

// 导出单例管理函数供 IPC index 使用
export { setAIService, getAIService };
