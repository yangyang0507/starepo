/**
 * AIService streamChat 方法单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AIService } from '@main/services/ai/ai-service';
import { AISettings, StreamChunk } from '@shared/types';
import { streamText } from 'ai';

// Mock AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
}));

// Mock 工具系统
vi.mock('@main/services/ai/tools', () => ({
  initializeTools: vi.fn(),
  tools: {},
}));

// Mock LanceDB 搜索服务
vi.mock('@main/services/search/lancedb-search-service', () => ({
  LanceDBSearchService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
  })),
}));

// Mock Provider Registry
vi.mock('@main/services/ai/registry-init', () => ({
  globalProviderRegistry: {
    getProvider: vi.fn().mockReturnValue({
      id: 'openai',
      validation: {
        apiKeyRequired: true,
        baseUrlRequired: false,
      },
    }),
  },
}));

// Mock Provider Account Service
vi.mock('@main/services/ai/storage/provider-account-service', () => ({
  ProviderAccountService: {
    getInstance: vi.fn().mockReturnValue({
      getAccount: vi.fn(),
    }),
  },
}));

describe('AIService.streamChat', () => {
  let aiService: AIService;
  const mockSettings: AISettings = {
    enabled: true,
    provider: 'openai',
    apiKey: 'test-api-key',
    model: 'gpt-4',
    temperature: 0.7,
    topP: 1.0,
  };

  beforeEach(async () => {
    aiService = new AIService();
    await aiService.initialize(mockSettings);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('应该正确处理文本流', async () => {
    const chunks: StreamChunk[] = [];
    const mockStream = {
      fullStream: (async function* () {
        yield { type: 'text-delta', textDelta: 'Hello' };
        yield { type: 'text-delta', textDelta: ' World' };
        yield {
          type: 'finish',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
      })(),
    };

    vi.mocked(streamText).mockReturnValue(mockStream as any);

    await aiService.streamChat(
      'Test message',
      'test-conversation',
      (chunk) => {
        chunks.push(chunk);
      }
    );

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual({ type: 'text', content: 'Hello' });
    expect(chunks[1]).toEqual({ type: 'text', content: ' World' });
    expect(chunks[2]).toEqual({
      type: 'end',
      content: 'Hello World',
      metadata: {
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        references: undefined,
      },
    });
  });

  it('应该正确处理工具调用', async () => {
    const chunks: StreamChunk[] = [];
    const mockStream = {
      fullStream: (async function* () {
        yield {
          type: 'tool-call',
          toolCallId: 'call_123',
          toolName: 'search_repositories',
          args: { query: 'react' },
        };
        yield {
          type: 'tool-result',
          toolCallId: 'call_123',
          result: { repositories: [] },
        };
        yield {
          type: 'finish',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
      })(),
    };

    vi.mocked(streamText).mockReturnValue(mockStream as any);

    await aiService.streamChat(
      'Search for react',
      'test-conversation',
      (chunk) => {
        chunks.push(chunk);
      }
    );

    expect(chunks).toHaveLength(3);
    expect(chunks[0].type).toBe('tool');
    expect(chunks[0].toolCall?.name).toBe('search_repositories');
    expect(chunks[0].toolCall?.status).toBe('calling');
    expect(chunks[1].type).toBe('tool');
    expect(chunks[1].toolCall?.status).toBe('result');
  });

  it('应该正确处理错误', async () => {
    const chunks: StreamChunk[] = [];
    const mockStream = {
      fullStream: (async function* () {
        yield {
          type: 'error',
          error: { message: 'API Error' },
        };
      })(),
    };

    vi.mocked(streamText).mockReturnValue(mockStream as any);

    await aiService.streamChat(
      'Test message',
      'test-conversation',
      (chunk) => {
        chunks.push(chunk);
      }
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('error');
    expect(chunks[0].error).toBe('API Error');
  });

  it('应该支持中断信号', async () => {
    const chunks: StreamChunk[] = [];
    const controller = new AbortController();
    const mockStream = {
      fullStream: (async function* () {
        yield { type: 'text-delta', textDelta: 'Hello' };
        // 模拟中断
        controller.abort();
        yield { type: 'text-delta', textDelta: ' World' };
      })(),
    };

    vi.mocked(streamText).mockReturnValue(mockStream as any);

    await aiService.streamChat(
      'Test message',
      'test-conversation',
      (chunk) => {
        chunks.push(chunk);
      },
      controller.signal
    );

    // 中断后应该停止接收 chunk
    expect(chunks.length).toBeLessThanOrEqual(1);
  });

  it('应该收集仓库引用', async () => {
    const chunks: StreamChunk[] = [];
    const mockRepositories = [
      {
        repositoryId: '1',
        repositoryName: 'test-repo',
        owner: 'test-owner',
        url: 'https://github.com/test-owner/test-repo',
        relevanceScore: 0.9,
      },
    ];

    const mockStream = {
      fullStream: (async function* () {
        yield {
          type: 'tool-result',
          toolCallId: 'call_123',
          result: { repositories: mockRepositories },
        };
        yield {
          type: 'finish',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        };
      })(),
    };

    vi.mocked(streamText).mockReturnValue(mockStream as any);

    await aiService.streamChat(
      'Search repos',
      'test-conversation',
      (chunk) => {
        chunks.push(chunk);
      }
    );

    const endChunk = chunks.find((c) => c.type === 'end');
    expect(endChunk?.metadata?.references).toEqual(mockRepositories);
  });

  it('应该在未初始化时抛出错误', async () => {
    const uninitializedService = new AIService();

    await expect(
      uninitializedService.streamChat('Test', 'test', () => {})
    ).rejects.toThrow('AI service not initialized');
  });
});
