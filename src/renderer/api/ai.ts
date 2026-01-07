/**
 * AI API 包装层
 * 处理 IPC 通信和本地存储
 * 通过 Electron preload 脚本暴露的 electronAPI 进行调用
 */

import { IPC_CHANNELS } from "@shared/constants";
import {
  AIResponse,
  AIChatPayload,
  IPCResponse,
  StreamChunk,
  ProviderAccountMetadata,
} from "@shared/types";
import type {
  ProviderAccountConfig,
  ModelListResponse,
  ProviderOption,
  ConnectionTestResult,
} from "@shared/types/ai-provider";

const getInvoke = () => {
  if (typeof window !== "undefined" && window.electronAPI?.invoke) {
    return window.electronAPI.invoke;
  }
  throw new Error("electronAPI not available");
};

/**
 * 发送聊天消息
 */
export async function sendChatMessage(
  message: string,
  conversationId?: string,
  userId?: string,
): Promise<AIResponse> {
  const payload: AIChatPayload = {
    message,
    conversationId,
    userId,
  };

  const invoke = getInvoke();
  const response: IPCResponse<AIResponse> = (await invoke(
    IPC_CHANNELS.AI.CHAT,
    payload,
  )) as IPCResponse<AIResponse>;

  if (!response.success) {
    throw new Error(response.error || "Failed to send message");
  }

  return response.data || { content: "", references: [] };
}

/**
 * 流式聊天选项
 */
export interface StreamChatOptions {
  onTextDelta?: (text: string) => void;
  onToolCall?: (toolCall: {
    name: string;
    arguments: Record<string, unknown>;
  }) => void;
  onComplete?: (data: AIResponse) => void;
  onError?: (error: string) => void;
}

/**
 * 发送流式聊天消息
 */
export async function sendChatMessageStream(
  message: string,
  conversationId?: string,
  userId?: string,
  options?: StreamChatOptions,
): Promise<{ sessionId: string; abort: () => Promise<void> }> {
  console.log("[AI API] sendChatMessageStream called:", {
    message,
    conversationId,
  });

  const electronAPI = (window as any).electronAPI;
  console.log("[AI API] electronAPI:", electronAPI);
  console.log("[AI API] electronAPI.ai:", electronAPI?.ai);
  console.log(
    "[AI API] electronAPI.ai.chatStream:",
    electronAPI?.ai?.chatStream,
  );

  if (!electronAPI?.ai?.chatStream) {
    console.error("[AI API] Stream chat API not available");
    throw new Error("Stream chat API not available");
  }

  console.log("[AI API] Calling electronAPI.ai.chatStream...");
  const response = await electronAPI.ai.chatStream(
    message,
    conversationId,
    (chunk: StreamChunk & { sessionId: string }) => {
      console.log("[AI API] Chunk received:", chunk);
      switch (chunk.type) {
        case "text":
          options?.onTextDelta?.(chunk.content);
          break;
        case "tool":
          if (chunk.toolCall) {
            options?.onToolCall?.({
              name: chunk.toolCall.name,
              arguments: chunk.toolCall.arguments || {},
            });
          }
          break;
        case "end":
          console.log("[AI API] Stream ended:", chunk);
          options?.onComplete?.({
            content: chunk.content,
            references: chunk.metadata?.references || [],
            usage: chunk.metadata?.usage,
          });
          break;
        case "error":
          console.error("[AI API] Stream error:", chunk);
          options?.onError?.(chunk.error || "Unknown error");
          break;
      }
    },
  );

  console.log("[AI API] chatStream response:", response);

  if (!response.success) {
    throw new Error(response.error || "Failed to start stream");
  }

  const { sessionId } = response.data!;
  console.log("[AI API] Session ID:", sessionId);

  return {
    sessionId,
    abort: async () => {
      console.log("[AI API] Aborting session:", sessionId);
      await electronAPI.ai.abortChat(sessionId);
    },
  };
}

/**
 * 中止流式聊天
 */
export async function abortChat(sessionId: string): Promise<void> {
  const electronAPI = (window as any).electronAPI;
  if (!electronAPI?.ai?.abortChat) {
    throw new Error("Abort chat API not available");
  }

  const response = await electronAPI.ai.abortChat(sessionId);
  if (!response.success) {
    throw new Error(response.error || "Failed to abort chat");
  }
}

/**
 * 获取聊天历史
 */
export async function getChatHistory(conversationId: string) {
  const invoke = getInvoke();
  const response: IPCResponse = (await invoke(
    IPC_CHANNELS.AI.GET_CHAT_HISTORY,
    conversationId,
  )) as IPCResponse;

  if (!response.success) {
    throw new Error(response.error || "Failed to get chat history");
  }

  return response.data || [];
}

/**
 * 清除聊天历史
 */
export async function clearChatHistory(conversationId: string): Promise<void> {
  const invoke = getInvoke();
  const response: IPCResponse = (await invoke(
    IPC_CHANNELS.AI.CLEAR_CHAT_HISTORY,
    conversationId,
  )) as IPCResponse;

  if (!response.success) {
    throw new Error(response.error || "Failed to clear chat history");
  }
}

/**
 * 获取 Provider 列表
 */
export async function getProviderList(): Promise<ProviderOption[]> {
  const invoke = getInvoke();
  const response: IPCResponse<ProviderOption[]> = (await invoke(
    IPC_CHANNELS.AI.GET_PROVIDER_LIST,
  )) as IPCResponse<ProviderOption[]>;

  if (!response.success) {
    throw new Error(response.error || "Failed to get provider list");
  }

  return response.data || [];
}

/**
 * 获取模型列表
 */
export async function getModelList(
  config: ProviderAccountConfig,
  forceRefresh: boolean = false,
): Promise<ModelListResponse> {
  const invoke = getInvoke();
  const response: IPCResponse<ModelListResponse> = (await invoke(
    IPC_CHANNELS.AI.GET_MODEL_LIST,
    config,
    forceRefresh,
  )) as IPCResponse<ModelListResponse>;

  if (!response.success) {
    throw new Error(response.error || "Failed to get model list");
  }

  return response.data!;
}

/**
 * 清除模型缓存
 */
export async function clearModelCache(providerId?: string): Promise<void> {
  const invoke = getInvoke();
  const response: IPCResponse = (await invoke(
    IPC_CHANNELS.AI.CLEAR_MODEL_CACHE,
    providerId,
  )) as IPCResponse;

  if (!response.success) {
    throw new Error(response.error || "Failed to clear model cache");
  }
}

/**
 * 测试 Provider 连接
 */
export async function testProviderConnection(
  config: ProviderAccountConfig,
): Promise<ConnectionTestResult> {
  const invoke = getInvoke();
  const response: IPCResponse<ConnectionTestResult> = (await invoke(
    IPC_CHANNELS.AI.TEST_PROVIDER_CONNECTION,
    config,
  )) as IPCResponse<ConnectionTestResult>;

  if (!response.success) {
    throw new Error(response.error || "Connection test failed");
  }

  return response.data!;
}

/**
 * 保存 Provider 账户配置
 */
export async function saveProviderAccount(
  config: ProviderAccountConfig,
): Promise<void> {
  const invoke = getInvoke();
  const response: IPCResponse = (await invoke(
    IPC_CHANNELS.AI.SAVE_PROVIDER_ACCOUNT,
    config,
  )) as IPCResponse;

  if (!response.success) {
    throw new Error(response.error || "Failed to save provider account");
  }
}

/**
 * 获取 Provider 账户配置
 */
export async function getProviderAccount(
  providerId: string,
): Promise<ProviderAccountConfig | null> {
  const invoke = getInvoke();
  const response: IPCResponse<ProviderAccountConfig | null> = (await invoke(
    IPC_CHANNELS.AI.GET_PROVIDER_ACCOUNT,
    providerId,
  )) as IPCResponse<ProviderAccountConfig | null>;

  if (!response.success) {
    throw new Error(response.error || "Failed to get provider account");
  }

  return response.data || null;
}

/**
 * 删除 Provider 账户配置
 */
export async function deleteProviderAccount(providerId: string): Promise<void> {
  const invoke = getInvoke();
  const response: IPCResponse = (await invoke(
    IPC_CHANNELS.AI.DELETE_PROVIDER_ACCOUNT,
    providerId,
  )) as IPCResponse;

  if (!response.success) {
    throw new Error(response.error || "Failed to delete provider account");
  }
}

/**
 * 列出所有 Provider 账户
 */
export async function listProviderAccounts(): Promise<
  ProviderAccountMetadata[]
> {
  const invoke = getInvoke();
  const response: IPCResponse<ProviderAccountMetadata[]> = (await invoke(
    IPC_CHANNELS.AI.LIST_PROVIDER_ACCOUNTS,
  )) as IPCResponse<ProviderAccountMetadata[]>;

  if (!response.success) {
    throw new Error(response.error || "Failed to list provider accounts");
  }

  return response.data || [];
}

/**
 * 使用 Hook 的 AI API
 */
export function useAIApi() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sendMessage = React.useCallback(
    async (
      message: string,
      conversationId?: string,
      userId?: string,
    ): Promise<AIResponse> => {
      try {
        setIsLoading(true);
        setError(null);
        return await sendChatMessage(message, conversationId, userId);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    sendMessage,
    isLoading,
    error,
  };
}

// 需要导入 React
import React from "react";
