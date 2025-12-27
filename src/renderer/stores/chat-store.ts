/**
 * 聊天状态管理 Store
 * 使用 Zustand 进行状态管理
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatMessage, AIResponse } from '@shared/types';

interface ChatStore {
  // 状态
  messages: ChatMessage[];
  currentConversationId: string;
  conversations: Record<string, ChatMessage[]>;
  isStreaming: boolean;
  streamingMessageId: string | null;
  currentStreamSession: string | null;
  messageQueue: Array<{ id: string; message: string }>;
  isProcessingQueue: boolean;

  // 操作
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, content: string) => void;
  clearMessages: (conversationId?: string) => void;
  setConversationId: (id: string) => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  setStreaming: (isStreaming: boolean, messageId?: string) => void;
  regenerateLastResponse: () => void;

  // 流式聊天操作
  streamChat: (
    message: string,
    options?: {
      onTextDelta?: (text: string) => void;
      onComplete?: (data: AIResponse) => void;
      onError?: (error: string) => void;
    }
  ) => Promise<{ sessionId: string; abort: () => Promise<void> }>;
  abortCurrentStream: () => Promise<void>;
  processQueue: () => Promise<void>;

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
      currentStreamSession: null,
      messageQueue: [],
      isProcessingQueue: false,

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

      // 流式聊天方法
      streamChat: async (message, options) => {
        const state = get();
        console.log('[ChatStore] streamChat called:', { message, isStreaming: state.isStreaming });

        // 如果正在处理，添加到队列
        if (state.isStreaming) {
          console.log('[ChatStore] Already streaming, adding to queue');
          set({
            messageQueue: [...state.messageQueue, { id: Date.now().toString(), message }],
          });
          options?.onComplete?.({ content: '', references: [] } as AIResponse);
          return { sessionId: '', abort: async () => {} };
        }

        // 添加用户消息
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'user',
          content: message,
          timestamp: Date.now(),
        };
        state.addMessage(userMessage);

        // 创建助手消息占位符
        const assistantMessageId = (Date.now() + 1).toString();
        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
        };
        state.addMessage(assistantMessage);

        state.setStreaming(true, assistantMessageId);

        let accumulatedContent = '';

        try {
          console.log('[ChatStore] Importing sendChatMessageStream...');
          const { sendChatMessageStream } = await import('@/api/ai');
          console.log('[ChatStore] Calling sendChatMessageStream...');
          const result = await sendChatMessageStream(
            message,
            state.currentConversationId,
            undefined,
            {
              onTextDelta: (text) => {
                accumulatedContent += text;
                state.updateMessage(assistantMessageId, accumulatedContent);
                options?.onTextDelta?.(text);
              },
              onComplete: (data) => {
                console.log('[ChatStore] Stream complete:', data);
                state.setStreaming(false, null);
                set((state) => ({
                  conversations: {
                    ...state.conversations,
                    [state.currentConversationId]: state.conversations[state.currentConversationId]?.map(msg =>
                      msg.id === assistantMessageId
                        ? { ...msg, references: data.references }
                        : msg
                    ) || [],
                  },
                }));
                options?.onComplete?.(data);
              },
              onError: (error) => {
                console.error('[ChatStore] Stream error:', error);
                state.setStreaming(false, null);
                set((state) => ({
                  conversations: {
                    ...state.conversations,
                    [state.currentConversationId]: state.conversations[state.currentConversationId]?.map(msg =>
                      msg.id === assistantMessageId
                        ? { ...msg, error }
                        : msg
                    ) || [],
                  },
                }));
                options?.onError?.(error);
              },
            }
          );
          console.log('[ChatStore] sendChatMessageStream returned:', result);

          set({ currentStreamSession: result.sessionId });
          return result;
        } catch (error) {
          console.error('[ChatStore] streamChat error:', error);
          state.setStreaming(false, null);
          const errorMessage = error instanceof Error ? error.message : '发送消息失败';
          set((state) => ({
            conversations: {
              ...state.conversations,
              [state.currentConversationId]: state.conversations[state.currentConversationId]?.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, error: errorMessage }
                  : msg
              ) || [],
            },
          }));
          options?.onError?.(errorMessage);
          throw error;
        }
      },

      // 中止当前流式会话
      abortCurrentStream: async () => {
        const state = get();
        if (state.currentStreamSession && state.isStreaming) {
          const { abortChat } = await import('@/api/ai');
          await abortChat(state.currentStreamSession);
          set({ currentStreamSession: null, isStreaming: false, streamingMessageId: null });
        }
      },

      // 处理消息队列
      processQueue: async () => {
        const state = get();
        if (state.isProcessingQueue || state.messageQueue.length === 0) return;

        set({ isProcessingQueue: true });

        while (state.messageQueue.length > 0) {
          const currentQueue = get().messageQueue;
          if (currentQueue.length === 0) break;

          const next = currentQueue[0];
          set({ messageQueue: currentQueue.slice(1) });

          await get().streamChat(next.message);
        }

        set({ isProcessingQueue: false });
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
  // 重置流式状态，防止卡住
  store.setStreaming(false, null);
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
