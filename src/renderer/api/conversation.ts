/**
 * 会话相关 API 封装
 */

import { IPC_CHANNELS } from '@shared/constants';
import type {
  ConversationMeta,
  GenerateTitleRequest,
  GenerateTitleResponse,
  ConversationListResponse,
} from '@shared/types/conversation';
import type { IPCResponse } from '@shared/types';

const getInvoke = () => {
  if (typeof window !== 'undefined' && window.electronAPI?.invoke) {
    return window.electronAPI.invoke;
  }
  throw new Error('electronAPI not available');
};

/**
 * 生成对话标题
 */
export async function generateConversationTitle(
  request: GenerateTitleRequest
): Promise<GenerateTitleResponse> {
  const invoke = getInvoke();
  const response = await invoke(
    IPC_CHANNELS.AI.GENERATE_TITLE,
    request
  ) as IPCResponse<GenerateTitleResponse>;

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to generate title');
  }

  return response.data;
}

/**
 * 获取所有会话列表
 */
export async function getConversations(): Promise<ConversationMeta[]> {
  const invoke = getInvoke();
  const response = await invoke(
    IPC_CHANNELS.AI.GET_CONVERSATIONS
  ) as IPCResponse<ConversationListResponse>;

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to get conversations');
  }

  return response.data.conversations;
}

/**
 * 保存会话元数据
 */
export async function saveConversationMeta(
  conversationId: string,
  tempTitle: string
): Promise<ConversationMeta> {
  const invoke = getInvoke();
  const response = await invoke(
    IPC_CHANNELS.AI.SAVE_CONVERSATION_META,
    { conversationId, tempTitle }
  ) as IPCResponse<ConversationMeta>;

  if (!response.success || !response.data) {
    throw new Error(response.error || 'Failed to save conversation meta');
  }

  return response.data;
}

/**
 * 删除会话
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const invoke = getInvoke();
  const response = await invoke(
    IPC_CHANNELS.AI.DELETE_CONVERSATION,
    conversationId
  ) as IPCResponse<{ conversationId: string }>;

  if (!response.success) {
    throw new Error(response.error || 'Failed to delete conversation');
  }
}
