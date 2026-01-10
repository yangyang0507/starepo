/**
 * ChatStore 流式处理单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChatStore } from '@/stores/chat-store';
import { MessagePart, TextPart, ToolCallPart } from '@shared/types';

// Mock AI API
vi.mock('@/api/ai', () => ({
  sendChatMessageStream: vi.fn(),
  abortChat: vi.fn(),
}));

describe('ChatStore - 流式处理', () => {
  beforeEach(() => {
    // 重置 store
    const { result } = renderHook(() => useChatStore());
    act(() => {
      result.current.clearMessages();
    });
    vi.clearAllMocks();
  });

  it('应该正确初始化助手消息的 parts 数组', async () => {
    const { result } = renderHook(() => useChatStore());
    const { sendChatMessageStream } = await import('@/api/ai');

    vi.mocked(sendChatMessageStream).mockImplementation(
      async (_message, _conversationId, _userId, callbacks) => {
        // 模拟流式响应
        callbacks?.onTextDelta?.('Hello');
        callbacks?.onComplete?.({ content: 'Hello', references: [] });
        return { sessionId: 'test-session', abort: async () => {} };
      }
    );

    await act(async () => {
      await result.current.streamChat('Test message');
    });

    await waitFor(() => {
      const messages = result.current.messages;
      const assistantMessage = messages.find((m) => m.role === 'assistant');
      expect(assistantMessage?.parts).toBeDefined();
      expect(Array.isArray(assistantMessage?.parts)).toBe(true);
    });
  });

  it('应该正确处理文本流并追加到 TextPart', async () => {
    const { result } = renderHook(() => useChatStore());
    const { sendChatMessageStream } = await import('@/api/ai');

    vi.mocked(sendChatMessageStream).mockImplementation(
      async (_message, _conversationId, _userId, callbacks) => {
        callbacks?.onTextDelta?.('Hello');
        callbacks?.onTextDelta?.(' ');
        callbacks?.onTextDelta?.('World');
        callbacks?.onComplete?.({ content: 'Hello World', references: [] });
        return { sessionId: 'test-session', abort: async () => {} };
      }
    );

    await act(async () => {
      await result.current.streamChat('Test message');
    });

    await waitFor(() => {
      const messages = result.current.messages;
      const assistantMessage = messages.find((m) => m.role === 'assistant');
      const parts = assistantMessage?.parts as MessagePart[];

      expect(parts).toHaveLength(1);
      expect(parts[0].type).toBe('text');
      expect((parts[0] as TextPart).content).toBe('Hello World');
    });
  });

  it('应该正确处理工具调用并创建 ToolCallPart', async () => {
    const { result } = renderHook(() => useChatStore());
    const { sendChatMessageStream } = await import('@/api/ai');

    vi.mocked(sendChatMessageStream).mockImplementation(
      async (_message, _conversationId, _userId, callbacks) => {
        callbacks?.onToolCall?.({
          name: 'search_repositories',
          arguments: { query: 'react' },
          status: 'calling',
        });
        callbacks?.onToolCall?.({
          name: 'search_repositories',
          status: 'success',
          result: { repositories: [] },
        });
        callbacks?.onComplete?.({ content: '', references: [] });
        return { sessionId: 'test-session', abort: async () => {} };
      }
    );

    await act(async () => {
      await result.current.streamChat('Search for react');
    });

    await waitFor(() => {
      const messages = result.current.messages;
      const assistantMessage = messages.find((m) => m.role === 'assistant');
      const parts = assistantMessage?.parts as MessagePart[];

      const toolCallPart = parts.find((p) => p.type === 'tool_call') as ToolCallPart;
      expect(toolCallPart).toBeDefined();
      expect(toolCallPart.toolName).toBe('search_repositories');
      expect(toolCallPart.status).toBe('success');
      expect(toolCallPart.result).toEqual({ repositories: [] });
    });
  });

  it('应该正确处理文本和工具调用混合', async () => {
    const { result } = renderHook(() => useChatStore());
    const { sendChatMessageStream } = await import('@/api/ai');

    vi.mocked(sendChatMessageStream).mockImplementation(
      async (_message, _conversationId, _userId, callbacks) => {
        callbacks?.onTextDelta?.('Searching...');
        callbacks?.onToolCall?.({
          name: 'search_repositories',
          arguments: { query: 'react' },
          status: 'calling',
        });
        callbacks?.onToolCall?.({
          name: 'search_repositories',
          status: 'success',
          result: { repositories: [] },
        });
        callbacks?.onTextDelta?.('Found results');
        callbacks?.onComplete?.({ content: 'Searching...Found results', references: [] });
        return { sessionId: 'test-session', abort: async () => {} };
      }
    );

    await act(async () => {
      await result.current.streamChat('Search for react');
    });

    await waitFor(() => {
      const messages = result.current.messages;
      const assistantMessage = messages.find((m) => m.role === 'assistant');
      const parts = assistantMessage?.parts as MessagePart[];

      expect(parts.length).toBeGreaterThan(1);
      expect(parts[0].type).toBe('text');
      expect(parts.some((p) => p.type === 'tool_call')).toBe(true);
    });
  });

  it('应该保持 content 字段与 parts 同步', async () => {
    const { result } = renderHook(() => useChatStore());
    const { sendChatMessageStream } = await import('@/api/ai');

    vi.mocked(sendChatMessageStream).mockImplementation(
      async (_message, _conversationId, _userId, callbacks) => {
        callbacks?.onTextDelta?.('Hello');
        callbacks?.onTextDelta?.(' World');
        callbacks?.onComplete?.({ content: 'Hello World', references: [] });
        return { sessionId: 'test-session', abort: async () => {} };
      }
    );

    await act(async () => {
      await result.current.streamChat('Test message');
    });

    await waitFor(() => {
      const messages = result.current.messages;
      const assistantMessage = messages.find((m) => m.role === 'assistant');

      expect(assistantMessage?.content).toBe('Hello World');
      const textPart = assistantMessage?.parts?.[0] as TextPart;
      expect(textPart?.content).toBe('Hello World');
    });
  });

  it('应该正确处理流式错误', async () => {
    const { result } = renderHook(() => useChatStore());
    const { sendChatMessageStream } = await import('@/api/ai');

    vi.mocked(sendChatMessageStream).mockImplementation(
      async (_message, _conversationId, _userId, callbacks) => {
        callbacks?.onError?.('Network error');
        return { sessionId: 'test-session', abort: async () => {} };
      }
    );

    await act(async () => {
      await result.current.streamChat('Test message');
    });

    await waitFor(() => {
      const messages = result.current.messages;
      const assistantMessage = messages.find((m) => m.role === 'assistant');
      expect(assistantMessage?.error).toBe('Network error');
      expect(result.current.isStreaming).toBe(false);
    });
  });

  it('应该支持中断流式会话', async () => {
    const { result } = renderHook(() => useChatStore());
    const { sendChatMessageStream, abortChat } = await import('@/api/ai');

    const mockAbort = vi.fn();
    vi.mocked(sendChatMessageStream).mockImplementation(async () => {
      return { sessionId: 'test-session', abort: mockAbort };
    });

    await act(async () => {
      await result.current.streamChat('Test message');
    });

    await act(async () => {
      await result.current.abortCurrentStream();
    });

    expect(abortChat).toHaveBeenCalledWith('test-session');
    expect(result.current.isStreaming).toBe(false);
  });
});
