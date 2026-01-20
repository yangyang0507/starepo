/**
 * 会话相关 API 封装
 */

import { IPC_CHANNELS } from "@shared/constants";
import type {
  ConversationMeta,
  GenerateTitleRequest,
  GenerateTitleResponse,
  ConversationListResponse,
} from "@shared/types/conversation";
import type { IPCResponse } from "@shared/types";

const getInvoke = () => {
  if (typeof window !== "undefined" && window.electronAPI?.invoke) {
    return window.electronAPI.invoke;
  }
  throw new Error("electronAPI not available");
};

/**
 * 生成对话标题
 */
export async function generateConversationTitle(
  request: GenerateTitleRequest,
): Promise<GenerateTitleResponse> {
  console.log(
    "[ConversationAPI] ========== START generateConversationTitle ==========",
  );
  console.log("[ConversationAPI] Request:", {
    conversationId: request.conversationId,
    tempTitle: request.tempTitle,
    firstUserMessageLength: request.firstUserMessage?.length || 0,
    firstAssistantMessageLength: request.firstAssistantMessage?.length || 0,
  });

  const invoke = getInvoke();

  console.log(
    "[ConversationAPI] Invoking IPC channel:",
    IPC_CHANNELS.AI.GENERATE_TITLE,
  );

  const response = (await invoke(
    IPC_CHANNELS.AI.GENERATE_TITLE,
    request,
  )) as IPCResponse<GenerateTitleResponse>;

  console.log("[ConversationAPI] IPC response:", {
    success: response.success,
    hasData: !!response.data,
    error: response.error,
    data: response.data,
  });

  if (!response.success || !response.data) {
    console.error(
      "[ConversationAPI] Failed to generate title:",
      response.error,
    );
    console.log(
      "[ConversationAPI] ========== END generateConversationTitle (FAILED) ==========",
    );
    throw new Error(response.error || "Failed to generate title");
  }

  console.log("[ConversationAPI] Generated title:", response.data.title);
  console.log(
    "[ConversationAPI] ========== END generateConversationTitle (SUCCESS) ==========",
  );

  return response.data;
}

/**
 * 获取所有会话列表
 */
export async function getConversations(): Promise<ConversationMeta[]> {
  const invoke = getInvoke();
  const response = (await invoke(
    IPC_CHANNELS.AI.GET_CONVERSATIONS,
  )) as IPCResponse<ConversationListResponse>;

  if (!response.success || !response.data) {
    throw new Error(response.error || "Failed to get conversations");
  }

  return response.data.conversations;
}

/**
 * 保存会话元数据
 */
export async function saveConversationMeta(
  conversationId: string,
  tempTitle: string,
): Promise<ConversationMeta> {
  const invoke = getInvoke();
  const response = (await invoke(IPC_CHANNELS.AI.SAVE_CONVERSATION_META, {
    conversationId,
    tempTitle,
  })) as IPCResponse<ConversationMeta>;

  if (!response.success || !response.data) {
    throw new Error(response.error || "Failed to save conversation meta");
  }

  return response.data;
}

/**
 * 删除会话
 */
export async function deleteConversation(
  conversationId: string,
): Promise<void> {
  const invoke = getInvoke();
  const response = (await invoke(
    IPC_CHANNELS.AI.DELETE_CONVERSATION,
    conversationId,
  )) as IPCResponse<{ conversationId: string }>;

  if (!response.success) {
    throw new Error(response.error || "Failed to delete conversation");
  }
}
