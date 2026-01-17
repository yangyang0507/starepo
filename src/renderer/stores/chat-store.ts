/**
 * 聊天状态管理 Store（重构版）
 * 分离会话元数据（sessions）和消息内容（conversations）
 * 移除 Zustand persist，改用主进程持久化
 */

import { create } from 'zustand';
import { ChatMessage, AIResponse, TextPart, ToolCallPart } from '@shared/types/ai';
import type { ConversationMeta } from '@shared/types/conversation';
import {
  getConversations,
  generateConversationTitle,
  saveConversationMeta,
  deleteConversation as deleteConversationAPI,
} from '@/api/conversation';

interface ChatStore {
  // ========== 状态 ==========

  // 会话元数据（轻量级，用于侧边栏）
  sessions: Record<string, ConversationMeta>;

  // 消息内容（重量级，用于对话区域）
  conversations: Record<string, ChatMessage[]>;

  // 当前状态
  messages: ChatMessage[]; // 当前会话的消息（派生状态）
  currentConversationId: string;
  isStreaming: boolean;
  streamingMessageId: string | null;
  currentStreamSession: string | null;
  messageQueue: Array<{ id: string; message: string }>;
  isProcessingQueue: boolean;

  // ========== 初始化 ==========

  /**
   * 从主进程加载会话列表
   */
  hydrate: () => Promise<void>;

  // ========== 会话操作 ==========

  /**
   * 创建新会话
   */
  createSession: (id?: string) => string;

  /**
   * 选择会话
   */
  selectSession: (id: string) => void;

  /**
   * 删除会话
   */
  deleteSession: (id: string) => Promise<void>;

  /**
   * 更新会话标题
   */
  updateSessionTitle: (id: string, title: string, isGenerated?: boolean) => void;

  /**
   * 生成智能标题
   */
  generateTitle: (conversationId: string) => Promise<void>;

  // ========== 消息操作 ==========

  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, content: string) => void;
  clearMessages: (conversationId?: string) => void;
  setConversationId: (id: string) => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  setStreaming: (isStreaming: boolean, messageId?: string | null) => void;
  regenerateLastResponse: () => void;

  // ========== 流式聊天 ==========

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

  // ========== 存储操作（保留兼容性） ==========

  saveToStorage: () => void;
  loadFromStorage: () => void;
}

/**
 * 本地存储的 Key（仅用于消息内容）
 */
const MESSAGES_STORAGE_KEY = 'starepo:chat-messages';

/**
 * 创建 Chat Store
 */
export const useChatStore = create<ChatStore>((set, get) => ({
  // ========== 初始状态 ==========

  sessions: {},
  conversations: {},
  messages: [],
  currentConversationId: 'default',
  isStreaming: false,
  streamingMessageId: null,
  currentStreamSession: null,
  messageQueue: [],
  isProcessingQueue: false,

  // ========== 初始化 ==========

  /**
   * 从主进程加载会话列表
   */
  hydrate: async () => {
    try {
      // 1. 从主进程加载会话元数据
      const conversationList = await getConversations();
      const sessions: Record<string, ConversationMeta> = {};
      conversationList.forEach(meta => {
        sessions[meta.id] = meta;
      });

      // 2. 从 localStorage 加载消息内容
      const stored = localStorage.getItem(MESSAGES_STORAGE_KEY);
      let conversations: Record<string, ChatMessage[]> = {};
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          conversations = parsed.conversations || {};
        } catch (error) {
          console.error('[ChatStore] Failed to parse stored messages:', error);
        }
      }

      // 3. 确保 default 会话存在
      if (!sessions['default']) {
        sessions['default'] = {
          id: 'default',
          title: '新对话',
          tempTitle: '新对话',
          isTitleGenerated: false,
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }

      if (!conversations['default']) {
        conversations['default'] = [];
      }

      // 4. 更新状态
      set({
        sessions,
        conversations,
        messages: conversations[get().currentConversationId] || [],
      });

      console.log('[ChatStore] Hydrated:', {
        sessionCount: Object.keys(sessions).length,
        conversationCount: Object.keys(conversations).length,
      });
    } catch (error) {
      console.error('[ChatStore] Failed to hydrate:', error);
    }
  },

  // ========== 会话操作 ==========

  /**
   * 创建新会话
   */
  createSession: (id?: string) => {
    const newId = id || Date.now().toString();
    const tempTitle = '新对话';

    // 创建会话元数据
    const meta: ConversationMeta = {
      id: newId,
      title: tempTitle,
      tempTitle,
      isTitleGenerated: false,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    set((state) => ({
      sessions: {
        ...state.sessions,
        [newId]: meta,
      },
      conversations: {
        ...state.conversations,
        [newId]: [],
      },
      currentConversationId: newId,
      messages: [],
    }));

    // 异步保存到主进程
    saveConversationMeta(newId, tempTitle).catch(error => {
      console.error('[ChatStore] Failed to save conversation meta:', error);
    });

    return newId;
  },

  /**
   * 选择会话
   */
  selectSession: (id: string) => {
    set((state) => ({
      currentConversationId: id,
      messages: state.conversations[id] || [],
    }));
  },

  /**
   * 删除会话
   */
  deleteSession: async (id: string) => {
    try {
      // 从主进程删除
      await deleteConversationAPI(id);

      // 更新本地状态
      set((state) => {
        const newSessions = { ...state.sessions };
        const newConversations = { ...state.conversations };
        delete newSessions[id];
        delete newConversations[id];

        // 如果删除的是当前会话，切换到 default
        const newCurrentId = id === state.currentConversationId ? 'default' : state.currentConversationId;

        return {
          sessions: newSessions,
          conversations: newConversations,
          currentConversationId: newCurrentId,
          messages: newConversations[newCurrentId] || [],
        };
      });

      // 保存到 localStorage
      get().saveToStorage();
    } catch (error) {
      console.error('[ChatStore] Failed to delete session:', error);
      throw error;
    }
  },

  /**
   * 更新会话标题
   */
  updateSessionTitle: (id: string, title: string, isGenerated: boolean = false) => {
    set((state) => {
      const session = state.sessions[id];
      if (!session) return state;

      return {
        sessions: {
          ...state.sessions,
          [id]: {
            ...session,
            title,
            isTitleGenerated: isGenerated,
            status: isGenerated ? 'ready' : session.status,
            updatedAt: Date.now(),
          },
        },
      };
    });
  },

  /**
   * 生成智能标题
   */
  generateTitle: async (conversationId: string) => {
    const state = get();
    const messages = state.conversations[conversationId];

    if (!messages || messages.length === 0) {
      console.warn('[ChatStore] No messages to generate title from');
      return;
    }

    const firstUserMsg = messages.find(m => m.role === 'user');
    const firstAssistantMsg = messages.find(m => m.role === 'assistant');

    if (!firstUserMsg) {
      console.warn('[ChatStore] No user message found');
      return;
    }

    // 生成临时标题
    const tempTitle = firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '');

    try {
      // 调用 API 生成智能标题
      const result = await generateConversationTitle({
        conversationId,
        firstUserMessage: firstUserMsg.content,
        firstAssistantMessage: firstAssistantMsg?.content,
        tempTitle,
      });

      // 更新标题
      get().updateSessionTitle(conversationId, result.title, true);

      console.log('[ChatStore] Generated title:', result.title);
    } catch (error) {
      console.error('[ChatStore] Failed to generate title:', error);
      // 失败时使用临时标题
      get().updateSessionTitle(conversationId, tempTitle, true);
    }
  },

  // ========== 消息操作 ==========

  /**
   * 添加消息
   */
  addMessage: (message) => {
    set((state) => {
      const conversationId = state.currentConversationId;
      const messages = [...(state.conversations[conversationId] || []), message];

      // 确保 session 存在，如果不存在则创建
      let session = state.sessions[conversationId];
      if (!session) {
        // 自动创建 session
        const tempTitle = message.role === 'user'
          ? message.content.substring(0, 30) + (message.content.length > 30 ? '...' : '')
          : '新对话';

        session = {
          id: conversationId,
          title: tempTitle,
          tempTitle,
          isTitleGenerated: false,
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        // 异步保存到主进程
        saveConversationMeta(conversationId, tempTitle).catch(error => {
          console.error('[ChatStore] Failed to save conversation meta:', error);
        });
      } else {
        // 更新现有 session 的最后活动时间
        session = {
          ...session,
          updatedAt: Date.now(),
        };
      }

      return {
        messages,
        conversations: {
          ...state.conversations,
          [conversationId]: messages,
        },
        sessions: {
          ...state.sessions,
          [conversationId]: session,
        },
      };
    });

    // 保存到 localStorage
    get().saveToStorage();
  },

  /**
   * 更新消息（流式输出）
   */
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

  /**
   * 清除消息
   */
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

    get().saveToStorage();
  },

  /**
   * 设置当前对话 ID
   */
  setConversationId: (id) => {
    set((state) => ({
      currentConversationId: id,
      messages: state.conversations[id] || [],
    }));
  },

  /**
   * 加载对话
   */
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

  /**
   * 删除对话（别名）
   */
  deleteConversation: (id) => {
    get().deleteSession(id);
  },

  /**
   * 设置流式状态
   */
  setStreaming: (isStreaming, messageId = null) => {
    set({ isStreaming, streamingMessageId: messageId });
  },

  /**
   * 重新生成最后一条回复
   */
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

  // ========== 流式聊天 ==========

  /**
   * 流式聊天
   */
  streamChat: async (message, options = {}) => {
    const state = get();

    // 添加用户消息
    const userMessageId = Date.now().toString();
    const userMessage: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: message,
      timestamp: Date.now(),
    };
    state.addMessage(userMessage);

    // 创建助手消息占位符（支持 parts）
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      parts: [], // 初始化 parts 数组
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

            // 更新 parts 数组
            set((state) => {
              const conversationId = state.currentConversationId;
              const messages = state.conversations[conversationId]?.map(msg => {
                if (msg.id === assistantMessageId) {
                  const parts = [...(msg.parts || [])];
                  const lastPartIndex = parts.length - 1;
                  const lastPart = parts[lastPartIndex];

                  // 如果最后一个 part 是 text，追加内容
                  if (lastPart && lastPart.type === 'text') {
                    parts[lastPartIndex] = {
                      ...lastPart,
                      content: (lastPart as TextPart).content + text,
                    };
                  } else {
                    // 否则创建新的 TextPart
                    parts.push({
                      type: 'text',
                      id: `text_${Date.now()}`,
                      content: text,
                    } as TextPart);
                  }

                  return {
                    ...msg,
                    content: accumulatedContent,
                    parts,
                  };
                }
                return msg;
              }) || [];

              return {
                messages,
                conversations: {
                  ...state.conversations,
                  [conversationId]: messages,
                },
              };
            });

            options.onTextDelta?.(text);
          },
          onToolCall: (toolCall) => {
            console.log('[ChatStore] Tool call:', toolCall);

            // 添加 ToolCallPart
            set((state) => {
              const conversationId = state.currentConversationId;
              const messages = state.conversations[conversationId]?.map(msg => {
                if (msg.id === assistantMessageId) {
                  const parts = [...(msg.parts || [])];
                  parts.push({
                    type: 'tool-call',
                    id: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    args: toolCall.args,
                  } as ToolCallPart);

                  return {
                    ...msg,
                    parts,
                  };
                }
                return msg;
              }) || [];

              return {
                messages,
                conversations: {
                  ...state.conversations,
                  [conversationId]: messages,
                },
              };
            });
          },
          onToolResult: (toolResult) => {
            console.log('[ChatStore] Tool result:', toolResult);

            // 更新对应的 ToolCallPart，添加 result
            set((state) => {
              const conversationId = state.currentConversationId;
              const messages = state.conversations[conversationId]?.map(msg => {
                if (msg.id === assistantMessageId) {
                  const parts = msg.parts?.map(part => {
                    if (part.type === 'tool-call' && part.id === toolResult.toolCallId) {
                      return {
                        ...part,
                        result: toolResult.result,
                      } as ToolCallPart;
                    }
                    return part;
                  }) || [];

                  return {
                    ...msg,
                    parts,
                  };
                }
                return msg;
              }) || [];

              return {
                messages,
                conversations: {
                  ...state.conversations,
                  [conversationId]: messages,
                },
              };
            });
          },
          onComplete: (data) => {
            console.log('[ChatStore] Stream complete:', data);
            state.setStreaming(false, null);

            // 保存到 localStorage
            state.saveToStorage();

            // 🔥 关键：检查是否需要生成标题
            const currentMessages = get().conversations[get().currentConversationId] || [];
            const session = get().sessions[get().currentConversationId];

            console.log('[ChatStore] Title generation check:', {
              conversationId: get().currentConversationId,
              messageCount: currentMessages.length,
              hasSession: !!session,
              isTitleGenerated: session?.isTitleGenerated,
              shouldGenerate: currentMessages.length === 2 && session && !session.isTitleGenerated,
            });

            // 如果是第一次对话（2条消息：1问1答）且未生成标题
            if (currentMessages.length === 2 && session && !session.isTitleGenerated) {
              console.log('[ChatStore] Triggering title generation...');
              get().generateTitle(get().currentConversationId);
            }

            options.onComplete?.(data);
          },
          onError: (error) => {
            console.error('[ChatStore] Stream error:', error);
            state.setStreaming(false, null);
            options.onError?.(error);
          },
        }
      );

      return result;
    } catch (error) {
      console.error('[ChatStore] Send message error:', error);
      state.setStreaming(false, null);
      throw error;
    }
  },

  /**
   * 中止当前流
   */
  abortCurrentStream: async () => {
    const state = get();
    if (state.currentStreamSession) {
      try {
        const { abortChatStream } = await import('@/api/ai');
        await abortChatStream(state.currentStreamSession);
        state.setStreaming(false, null);
      } catch (error) {
        console.error('[ChatStore] Failed to abort stream:', error);
      }
    }
  },

  /**
   * 处理队列
   */
  processQueue: async () => {
    // 队列处理逻辑（保持原有实现）
    console.log('[ChatStore] Process queue called');
  },

  // ========== 存储操作 ==========

  /**
   * 保存到本地存储（仅保存消息内容）
   */
  saveToStorage: () => {
    try {
      const state = get();
      const data = {
        conversations: state.conversations,
        currentConversationId: state.currentConversationId,
      };
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[ChatStore] Failed to save to localStorage:', error);
    }
  },

  /**
   * 从本地存储加载（仅加载消息内容）
   */
  loadFromStorage: () => {
    try {
      const data = localStorage.getItem(MESSAGES_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        set({
          conversations: parsed.conversations || {},
          currentConversationId: parsed.currentConversationId || 'default',
          messages: parsed.conversations?.[parsed.currentConversationId || 'default'] || [],
        });
      }
    } catch (error) {
      console.error('[ChatStore] Failed to load from localStorage:', error);
    }
  },
}));

/**
 * 初始化 Chat Store
 * 应在应用启动时调用
 */
export function initializeChatStore() {
  const store = useChatStore.getState();

  // 加载数据
  store.hydrate().catch(error => {
    console.error('[ChatStore] Failed to initialize:', error);
  });

  // 重置流式状态，防止卡住
  store.setStreaming(false, null);
}

/**
 * 获取所有对话 ID
 */
export function getConversationIds(): string[] {
  const state = useChatStore.getState();
  return Object.keys(state.sessions);
}

/**
 * 获取对话摘要（用于对话列表）
 */
export function getConversationSummary(conversationId: string) {
  const state = useChatStore.getState();
  const session = state.sessions[conversationId];
  const messages = state.conversations[conversationId] || [];

  if (!session) {
    // 如果没有会话元数据，返回默认值
    return {
      id: conversationId,
      title: `对话 ${conversationId === 'default' ? '1' : conversationId.slice(-3)}`,
      preview: messages.length > 0 ? messages[messages.length - 1].content.substring(0, 50) : '暂无消息',
      messageCount: messages.length,
      lastMessageTime: messages.length > 0 ? messages[messages.length - 1].timestamp : 0,
    };
  }

  return {
    id: session.id,
    title: session.title,
    preview: messages.length > 0 ? messages[messages.length - 1].content.substring(0, 50) : '暂无消息',
    messageCount: messages.length,
    lastMessageTime: session.updatedAt,
  };
}
