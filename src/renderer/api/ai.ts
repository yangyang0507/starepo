/**
 * AI API 包装层
 * 处理 IPC 通信和本地存储
 * 通过 Electron preload 脚本暴露的 electronAPI 进行调用
 */

import { IPC_CHANNELS } from '@shared/constants/ipc-channels';
import {
  AIResponse,
  AISafeSettings,
  AIChatPayload,
  AISettingsPayload,
  AITestConnectionPayload,
  IPCResponse,
} from '@shared/types';

const getInvoke = () => {
  if (typeof window !== 'undefined' && window.electronAPI?.invoke) {
    return window.electronAPI.invoke;
  }
  throw new Error('electronAPI not available');
};

/**
 * 发送聊天消息
 */
export async function sendChatMessage(
  message: string,
  conversationId?: string,
  userId?: string
): Promise<AIResponse> {
  const payload: AIChatPayload = {
    message,
    conversationId,
    userId,
  };

  const invoke = getInvoke();
  const response: IPCResponse<AIResponse> = await invoke(
    IPC_CHANNELS.AI.CHAT,
    payload
  ) as IPCResponse<AIResponse>;

  if (!response.success) {
    throw new Error(response.error || 'Failed to send message');
  }

  return response.data || { content: '', references: [] };
}

/**
 * 获取 AI 设置
 */
export async function getAISettings(): Promise<AISafeSettings | null> {
  const invoke = getInvoke();
  const response: IPCResponse<AISafeSettings> = await invoke(
    IPC_CHANNELS.AI.GET_SAFE_SETTINGS
  ) as IPCResponse<AISafeSettings>;

  if (!response.success) {
    throw new Error(response.error || 'Failed to get AI settings');
  }

  return response.data || null;
}

/**
 * 更新 AI 设置
 */
export async function updateAISettings(settings: AISettingsPayload): Promise<void> {
  const invoke = getInvoke();
  const response: IPCResponse = await invoke(
    IPC_CHANNELS.AI.SET_SETTINGS,
    settings
  ) as IPCResponse;

  if (!response.success) {
    throw new Error(response.error || 'Failed to update AI settings');
  }
}

/**
 * 测试连接
 */
export async function testConnection(config: AITestConnectionPayload): Promise<boolean> {
  const invoke = getInvoke();
  const response: IPCResponse<boolean> = await invoke(
    IPC_CHANNELS.AI.TEST_CONNECTION,
    config
  ) as IPCResponse<boolean>;

  if (!response.success) {
    throw new Error(response.error || 'Connection test failed');
  }

  return response.data || false;
}

/**
 * 获取聊天历史
 */
export async function getChatHistory(conversationId: string) {
  const invoke = getInvoke();
  const response: IPCResponse = await invoke(
    IPC_CHANNELS.AI.GET_CHAT_HISTORY,
    conversationId
  ) as IPCResponse;

  if (!response.success) {
    throw new Error(response.error || 'Failed to get chat history');
  }

  return response.data || [];
}

/**
 * 清除聊天历史
 */
export async function clearChatHistory(conversationId: string): Promise<void> {
  const invoke = getInvoke();
  const response: IPCResponse = await invoke(
    IPC_CHANNELS.AI.CLEAR_CHAT_HISTORY,
    conversationId
  ) as IPCResponse;

  if (!response.success) {
    throw new Error(response.error || 'Failed to clear chat history');
  }
}

/**
 * 使用 Hook 的 AI API
 */
export function useAIApi() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sendMessage = React.useCallback(
    async (message: string, conversationId?: string, userId?: string): Promise<AIResponse> => {
      try {
        setIsLoading(true);
        setError(null);
        return await sendChatMessage(message, conversationId, userId);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const getSettings = React.useCallback(async () => {
    try {
      setError(null);
      return await getAISettings();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const updateSettings = React.useCallback(async (settings: AISettingsPayload) => {
    try {
      setError(null);
      await updateAISettings(settings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const test = React.useCallback(async (config: AITestConnectionPayload) => {
    try {
      setError(null);
      return await testConnection(config);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    }
  }, []);

  return {
    sendMessage,
    getAISettings: getSettings,
    updateAISettings: updateSettings,
    testConnection: test,
    isLoading,
    error,
  };
}

// 需要导入 React
import React from 'react';
