/**
 * 聊天状态管理 Store
 * 使用 Zustand 进行状态管理
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatMessage } from '@shared/types';

interface ChatStore {
  // 状态
  messages: ChatMessage[];
  currentConversationId: string;
  conversations: Record<string, ChatMessage[]>;
  isStreaming: boolean;
  streamingMessageId: string | null;

  // 操作
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, content: string) => void;
  clearMessages: (conversationId?: string) => void;
  setConversationId: (id: string) => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  setStreaming: (isStreaming: boolean, messageId?: string) => void;
  regenerateLastResponse: () => void;

  // 存储操作
  saveToStorage: () => void;
  loadFromStorage: () => void;
}

/**
 * 本地存储的 Key
 */
const STORAGE_KEY = 'starepo:chat-store';

/**
 * 创建 Chat Store
 */
export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      messages: [],
      currentConversationId: 'default',
      conversations: {
        default: [],
      },
      isStreaming: false,
      streamingMessageId: null,

      // 添加消息
      addMessage: (message) => {
        set((state) => {
          const conversationId = state.currentConversationId;
          const messages = [...(state.conversations[conversationId] || []), message];
          return {
            messages,
            conversations: {
              ...state.conversations,
              [conversationId]: messages,
            },
          };
        });
      },

      // 更新消息（流式输出）
      updateMessage: (id, content) => {
        set((state) => {
          const conversationId = state.currentConversationId;
          const messages = state.conversations[conversationId]?.map(msg =>
            msg.id === id ? { ...msg, content } : msg
          ) || [];
          return {
            messages,
            conversations: {
              ...state.conversations,
              [conversationId]: messages,
            },
          };
        });
      },

      // 设置流式输出状态
      setStreaming: (isStreaming, messageId) => {
        set({
          isStreaming,
          streamingMessageId: messageId || null,
        });
      },

      // 重新生成最后一条回复
      regenerateLastResponse: () => {
        const state = get();
        const conversationId = state.currentConversationId;
        const messages = state.conversations[conversationId] || [];
        const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
        if (lastUserMessage) {
          set((state) => ({
            conversations: {
              ...state.conversations,
              [conversationId]: messages.filter(m => m.id !== state.streamingMessageId),
            },
          }));
        }
      },

      // 清除消息
      clearMessages: (conversationId?: string) => {
        set((state) => {
          const id = conversationId || state.currentConversationId;
          const conversations = { ...state.conversations };
          delete conversations[id];

          // 如果清除的是当前对话，切换到 default
          const newCurrentId = id === state.currentConversationId ? 'default' : state.currentConversationId;

          return {
            messages: id === state.currentConversationId ? [] : state.messages,
            currentConversationId: newCurrentId,
            conversations: {
              ...conversations,
              default: conversations.default || [],
            },
          };
        });
      },

      // 设置当前对话 ID
      setConversationId: (id) => {
        set((state) => ({
          currentConversationId: id,
          messages: state.conversations[id] || [],
        }));
      },

      // 加载对话
      loadConversation: (id) => {
        set((state) => ({
          currentConversationId: id,
          messages: state.conversations[id] || [],
          conversations: {
            ...state.conversations,
            [id]: state.conversations[id] || [],
          },
        }));
      },

      // 删除对话
      deleteConversation: (id) => {
        set((state) => {
          const conversations = { ...state.conversations };
          delete conversations[id];

          // 如果删除的是当前对话，切换到 default
          const newCurrentId = id === state.currentConversationId ? 'default' : state.currentConversationId;

          return {
            currentConversationId: newCurrentId,
            messages: newCurrentId === state.currentConversationId ? state.messages : [],
            conversations: {
              ...conversations,
              default: conversations.default || [],
            },
          };
        });
      },

      // 保存到本地存储
      saveToStorage: () => {
        try {
          const state = get();
          const data = {
            messages: state.messages,
            currentConversationId: state.currentConversationId,
            conversations: state.conversations,
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
          console.error('Failed to save chat store to localStorage:', error);
        }
      },

      // 从本地存储加载
      loadFromStorage: () => {
        try {
          const data = localStorage.getItem(STORAGE_KEY);
          if (data) {
            const parsed = JSON.parse(data);
            set({
              messages: parsed.messages || [],
              currentConversationId: parsed.currentConversationId || 'default',
              conversations: parsed.conversations || { default: [] },
            });
          }
        } catch (error) {
          console.error('Failed to load chat store from localStorage:', error);
        }
      },
    }),
    {
      name: STORAGE_KEY,
      // 自动持久化配置
      partialize: (state) => ({
        messages: state.messages,
        currentConversationId: state.currentConversationId,
        conversations: state.conversations,
        isStreaming: state.isStreaming,
        streamingMessageId: state.streamingMessageId,
      }),
    }
  )
);

/**
 * 初始化 Chat Store
 * 应在应用启动时调用
 */
export function initializeChatStore() {
  const store = useChatStore.getState();
  store.loadFromStorage();
}

/**
 * 获取所有对话 ID
 */
export function getConversationIds(): string[] {
  const state = useChatStore.getState();
  return Object.keys(state.conversations);
}

/**
 * 获取对话摘要（用于对话列表）
 */
export function getConversationSummary(conversationId: string) {
  const state = useChatStore.getState();
  const messages = state.conversations[conversationId] || [];

  if (messages.length === 0) {
    return {
      id: conversationId,
      title: `对话 ${conversationId === 'default' ? '1' : conversationId.slice(-3)}`,
      preview: '暂无消息',
      messageCount: 0,
      lastMessageTime: 0,
    };
  }

  const firstUserMessage = messages.find((m) => m.role === 'user');
  const lastMessage = messages[messages.length - 1];

  return {
    id: conversationId,
    title: firstUserMessage?.content.substring(0, 30) || `对话 ${conversationId}`,
    preview: lastMessage?.content.substring(0, 50) || '暂无消息',
    messageCount: messages.length,
    lastMessageTime: lastMessage?.timestamp || 0,
  };
}
