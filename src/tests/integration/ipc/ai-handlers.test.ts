/**
 * IPC 流式通信集成测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain, BrowserWindow } from 'electron';
import { initializeAIHandlers } from '@main/ipc/ai-handlers';
import { AIService, setAIService } from '@main/services/ai';
import { IPC_CHANNELS } from '@shared/constants';
import { StreamChunk } from '@shared/types';

// Mock Electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  BrowserWindow: vi.fn(),
}));

// Mock AIService
vi.mock('@main/services/ai', () => ({
  AIService: vi.fn(),
  setAIService: vi.fn(),
  getAIService: vi.fn(),
}));

describe('IPC 流式通信集成测试', () => {
  let mockAIService: any;
  let mockWebContents: any;
  let handlers: Map<string, Function>;

  beforeEach(() => {
    handlers = new Map();

    // Mock ipcMain.handle
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Function) => {
      handlers.set(channel, handler);
    });

    // Mock WebContents
    mockWebContents = {
      send: vi.fn(),
    };

    // Mock AIService
    mockAIService = {
      streamChat: vi.fn(),
    };

    vi.mocked(AIService).mockImplementation(() => mockAIService);
    setAIService(mockAIService);

    // 初始化 handlers
    initializeAIHandlers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    handlers.clear();
  });

  it('应该注册 CHAT_STREAM handler', () => {
    expect(handlers.has(IPC_CHANNELS.AI.CHAT_STREAM)).toBe(true);
  });

  it('应该注册 CHAT_ABORT handler', () => {
    expect(handlers.has(IPC_CHANNELS.AI.CHAT_ABORT)).toBe(true);
  });

  it('应该返回 sessionId', async () => {
    const handler = handlers.get(IPC_CHANNELS.AI.CHAT_STREAM);
    expect(handler).toBeDefined();

    mockAIService.streamChat.mockImplementation(async () => {
      // 模拟流式响应
    });

    const event = { sender: mockWebContents };
    const payload = {
      message: 'Test message',
      conversationId: 'test',
    };

    const response = await handler!(event, payload);

    expect(response.success).toBe(true);
    expect(response.data.sessionId).toBeDefined();
    expect(typeof response.data.sessionId).toBe('string');
  });

  it('应该通过 webContents.send 推送 chunk', async () => {
    const handler = handlers.get(IPC_CHANNELS.AI.CHAT_STREAM);
    const chunks: StreamChunk[] = [];

    mockAIService.streamChat.mockImplementation(
      async (_message: string, _conversationId: string, onChunk: Function) => {
        onChunk({ type: 'text', content: 'Hello' });
        onChunk({ type: 'text', content: ' World' });
        onChunk({ type: 'end', content: 'Hello World' });
      }
    );

    const event = { sender: mockWebContents };
    const payload = {
      message: 'Test message',
      conversationId: 'test',
    };

    await handler!(event, payload);

    // 等待异步流式完成
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockWebContents.send).toHaveBeenCalled();
    const calls = mockWebContents.send.mock.calls;

    // 检查是否发送了正确的 channel
    expect(calls[0][0]).toBe(IPC_CHANNELS.AI.CHAT_STREAM_CHUNK);

    // 检查是否包含 sessionId
    expect(calls[0][1].sessionId).toBeDefined();
  });

  it('应该正确处理工具调用 chunk', async () => {
    const handler = handlers.get(IPC_CHANNELS.AI.CHAT_STREAM);

    mockAIService.streamChat.mockImplementation(
      async (_message: string, _conversationId: string, onChunk: Function) => {
        onChunk({
          type: 'tool',
          content: '',
          toolCall: {
            id: 'call_123',
            name: 'search_repositories',
            status: 'calling',
            arguments: { query: 'react' },
          },
        });
        onChunk({
          type: 'tool',
          content: '',
          toolCall: {
            id: 'call_123',
            name: 'search_repositories',
            status: 'result',
            result: { repositories: [] },
          },
        });
      }
    );

    const event = { sender: mockWebContents };
    const payload = {
      message: 'Search for react',
      conversationId: 'test',
    };

    await handler!(event, payload);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const calls = mockWebContents.send.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);

    // 检查工具调用 chunk
    const toolCallChunk = calls.find((call) => call[1].type === 'tool');
    expect(toolCallChunk).toBeDefined();
    expect(toolCallChunk[1].toolCall).toBeDefined();
  });

  it('应该支持中断流式会话', async () => {
    const streamHandler = handlers.get(IPC_CHANNELS.AI.CHAT_STREAM);
    const abortHandler = handlers.get(IPC_CHANNELS.AI.CHAT_ABORT);

    let abortController: AbortController | null = null;

    mockAIService.streamChat.mockImplementation(
      async (
        _message: string,
        _conversationId: string,
        _onChunk: Function,
        signal?: AbortSignal
      ) => {
        // 保存 signal 以便测试
        if (signal) {
          abortController = { abort: vi.fn() } as any;
        }
      }
    );

    const event = { sender: mockWebContents };
    const payload = {
      message: 'Test message',
      conversationId: 'test',
    };

    // 启动流式会话
    const response = await streamHandler!(event, payload);
    const sessionId = response.data.sessionId;

    // 中断会话
    const abortResponse = await abortHandler!(event, sessionId);

    expect(abortResponse.success).toBe(true);
  });

  it('应该在错误时发送 error chunk', async () => {
    const handler = handlers.get(IPC_CHANNELS.AI.CHAT_STREAM);

    mockAIService.streamChat.mockImplementation(async () => {
      throw new Error('API Error');
    });

    const event = { sender: mockWebContents };
    const payload = {
      message: 'Test message',
      conversationId: 'test',
    };

    await handler!(event, payload);
    await new Promise((resolve) => setTimeout(resolve, 100));

    const calls = mockWebContents.send.mock.calls;
    const errorChunk = calls.find((call) => call[1].type === 'error');

    expect(errorChunk).toBeDefined();
    expect(errorChunk[1].error).toContain('API Error');
  });

  it('应该在流式完成后清理 session', async () => {
    const handler = handlers.get(IPC_CHANNELS.AI.CHAT_STREAM);

    mockAIService.streamChat.mockImplementation(
      async (_message: string, _conversationId: string, onChunk: Function) => {
        onChunk({ type: 'text', content: 'Hello' });
        onChunk({ type: 'end', content: 'Hello' });
      }
    );

    const event = { sender: mockWebContents };
    const payload = {
      message: 'Test message',
      conversationId: 'test',
    };

    const response = await handler!(event, payload);
    const sessionId = response.data.sessionId;

    // 等待流式完成
    await new Promise((resolve) => setTimeout(resolve, 200));

    // 尝试中断已完成的会话应该失败
    const abortHandler = handlers.get(IPC_CHANNELS.AI.CHAT_ABORT);
    const abortResponse = await abortHandler!(event, sessionId);

    expect(abortResponse.success).toBe(false);
    expect(abortResponse.error).toContain('Session not found');
  });
});
