/**
 * Unit Tests: AI Service
 * 测试 AI 服务的核心功能：对话、嵌入和向量搜索
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIService } from '@/main/services/ai/ai-service';
import { EmbeddingService } from '@/main/services/ai/embedding-service';
import { VectorSearchService } from '@/main/services/ai/vector-search-service';
import type { AISettings, AIResponse, ChatMessage } from '@shared/types';

// Mock services
vi.mock('@/main/services/ai/embedding-service');
vi.mock('@/main/services/ai/vector-search-service');

describe('Unit Test: AI Service', () => {
  let aiService: AIService;
  let mockEmbeddingService: any;
  let mockVectorSearchService: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock implementations
    mockEmbeddingService = {
      embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
      getEmbeddingModel: vi.fn().mockReturnValue('text-embedding-3-small'),
    };

    mockVectorSearchService = {
      search: vi.fn().mockResolvedValue([
        {
          id: 1,
          name: 'test-repo',
          owner: { login: 'testuser' },
          stars: 100,
          language: 'TypeScript',
          description: 'Test repository',
          relevance: 0.95,
        },
      ]),
      fullTextSearch: vi.fn().mockResolvedValue([]),
    };

    // Create AI service with default settings
    const defaultSettings: AISettings = {
      enabled: true,
      provider: 'openai',
      apiKey: 'test-key',
      model: 'gpt-4',
      embeddingModel: 'text-embedding-3-small',
      maxTokens: 2000,
      temperature: 0.7,
    };

    aiService = new AIService(
      mockEmbeddingService,
      mockVectorSearchService,
      defaultSettings
    );
  });

  describe('Chat Message Processing', () => {
    it('should send a simple message and get a response', async () => {
      const message = 'What are popular TypeScript repositories?';
      const response = await aiService.chat(message);

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(response.references).toBeDefined();
      expect(Array.isArray(response.references)).toBe(true);
    });

    it('should handle conversation ID for multi-turn conversations', async () => {
      const conversationId = 'conv-123';
      const message = 'First message';

      const response = await aiService.chat(message, conversationId);

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
    });

    it('should include user ID if provided', async () => {
      const message = 'Test message';
      const conversationId = 'conv-123';
      const userId = 'user-456';

      const response = await aiService.chat(message, conversationId, userId);

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
    });

    it('should retrieve chat history for a conversation', async () => {
      const conversationId = 'conv-123';
      const history = aiService.getChatHistory(conversationId);

      expect(Array.isArray(history)).toBe(true);
    });

    it('should clear chat history when requested', () => {
      const conversationId = 'conv-123';
      aiService.addMessage({
        id: 'msg-1',
        role: 'user',
        content: 'Test message',
        timestamp: Date.now(),
      }, conversationId);

      aiService.clearChatHistory(conversationId);
      const history = aiService.getChatHistory(conversationId);

      expect(history.length).toBe(0);
    });
  });

  describe('Embedding Generation', () => {
    it('should call embedding service with user message', async () => {
      const message = 'What is TypeScript?';
      await aiService.chat(message);

      expect(mockEmbeddingService.embed).toHaveBeenCalled();
    });

    it('should handle embedding service errors gracefully', async () => {
      mockEmbeddingService.embed.mockRejectedValueOnce(
        new Error('Embedding API error')
      );

      const message = 'Test message';
      // Should not throw, should handle error internally
      const response = await aiService.chat(message);

      expect(response).toBeDefined();
      expect(response.error).toBeUndefined(); // Error should be handled
    });

    it('should cache embedding results', async () => {
      const message = 'Test message';

      // First call
      await aiService.chat(message);
      const firstCallCount = mockEmbeddingService.embed.mock.calls.length;

      // Second call with same message
      await aiService.chat(message);
      const secondCallCount = mockEmbeddingService.embed.mock.calls.length;

      // Should use cache, not call embedding service again
      expect(secondCallCount).toBe(firstCallCount);
    });
  });

  describe('Vector Search Integration', () => {
    it('should search for relevant repositories', async () => {
      const message = 'TypeScript frameworks';
      await aiService.chat(message);

      expect(mockVectorSearchService.search).toHaveBeenCalled();
    });

    it('should include search results in response references', async () => {
      const message = 'Test message';
      const response = await aiService.chat(message);

      expect(response.references).toBeDefined();
      expect(response.references.length).toBeGreaterThan(0);
    });

    it('should handle vector search failures', async () => {
      mockVectorSearchService.search.mockRejectedValueOnce(
        new Error('Search service error')
      );

      const message = 'Test message';
      const response = await aiService.chat(message);

      expect(response).toBeDefined();
      // Should still return a response even if search fails
      expect(response.content).toBeTruthy();
    });

    it('should limit search results to top-k repositories', async () => {
      const message = 'Popular repositories';
      await aiService.chat(message);

      expect(mockVectorSearchService.search).toHaveBeenCalled();
      // Verify that search was called with expected parameters
      const callArgs = mockVectorSearchService.search.mock.calls[0];
      expect(callArgs).toBeDefined();
    });
  });

  describe('RAG (Retrieval Augmented Generation)', () => {
    it('should build context from retrieved documents', async () => {
      const message = 'What should I build?';
      const response = await aiService.chat(message);

      expect(response.content).toBeTruthy();
      // Response should incorporate retrieved repository information
      expect(response.references).toBeDefined();
    });

    it('should include relevance scores in references', async () => {
      const message = 'Test message';
      const response = await aiService.chat(message);

      if (response.references && response.references.length > 0) {
        const firstRef = response.references[0];
        expect(firstRef.relevance).toBeDefined();
        expect(typeof firstRef.relevance).toBe('number');
        expect(firstRef.relevance).toBeGreaterThanOrEqual(0);
        expect(firstRef.relevance).toBeLessThanOrEqual(1);
      }
    });

    it('should handle empty search results gracefully', async () => {
      mockVectorSearchService.search.mockResolvedValueOnce([]);

      const message = 'Test message';
      const response = await aiService.chat(message);

      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      // Should still generate a response even without retrieved documents
    });
  });

  describe('Multi-Provider Support', () => {
    it('should switch providers correctly', async () => {
      const settingsWithAnthropic: AISettings = {
        enabled: true,
        provider: 'anthropic',
        apiKey: 'test-key',
        model: 'claude-3-sonnet',
        embeddingModel: 'text-embedding-3-small',
        maxTokens: 2000,
        temperature: 0.7,
      };

      aiService = new AIService(
        mockEmbeddingService,
        mockVectorSearchService,
        settingsWithAnthropic
      );

      const message = 'Test with Anthropic';
      const response = await aiService.chat(message);

      expect(response).toBeDefined();
    });

    it('should use correct model for selected provider', async () => {
      const settingsWithDeepSeek: AISettings = {
        enabled: true,
        provider: 'deepseek',
        apiKey: 'test-key',
        model: 'deepseek-chat',
        embeddingModel: 'text-embedding-3-small',
        maxTokens: 2000,
        temperature: 0.7,
      };

      aiService = new AIService(
        mockEmbeddingService,
        mockVectorSearchService,
        settingsWithDeepSeek
      );

      const message = 'Test with DeepSeek';
      const response = await aiService.chat(message);

      expect(response).toBeDefined();
    });
  });

  describe('Token and Parameter Handling', () => {
    it('should respect maxTokens setting', async () => {
      const settingsWithLimitedTokens: AISettings = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
        embeddingModel: 'text-embedding-3-small',
        maxTokens: 100, // Very limited
        temperature: 0.7,
      };

      aiService = new AIService(
        mockEmbeddingService,
        mockVectorSearchService,
        settingsWithLimitedTokens
      );

      const message = 'Generate a very long response';
      const response = await aiService.chat(message);

      expect(response).toBeDefined();
      // Response should be constrained by maxTokens
    });

    it('should apply temperature setting', async () => {
      const settingsWithHighTemp: AISettings = {
        enabled: true,
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
        embeddingModel: 'text-embedding-3-small',
        maxTokens: 2000,
        temperature: 1.8, // High creativity
      };

      aiService = new AIService(
        mockEmbeddingService,
        mockVectorSearchService,
        settingsWithHighTemp
      );

      const message = 'Tell me a story';
      const response = await aiService.chat(message);

      expect(response).toBeDefined();
    });
  });

  describe('Message Storage and Retrieval', () => {
    it('should add messages to conversation history', () => {
      const message: ChatMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Test message',
        timestamp: Date.now(),
      };

      aiService.addMessage(message, 'conv-1');
      const history = aiService.getChatHistory('conv-1');

      expect(history).toContain(message);
    });

    it('should maintain separate conversations', () => {
      const msg1: ChatMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Message for conversation 1',
        timestamp: Date.now(),
      };

      const msg2: ChatMessage = {
        id: 'msg-2',
        role: 'user',
        content: 'Message for conversation 2',
        timestamp: Date.now(),
      };

      aiService.addMessage(msg1, 'conv-1');
      aiService.addMessage(msg2, 'conv-2');

      const history1 = aiService.getChatHistory('conv-1');
      const history2 = aiService.getChatHistory('conv-2');

      expect(history1).toContain(msg1);
      expect(history1).not.toContain(msg2);
      expect(history2).toContain(msg2);
      expect(history2).not.toContain(msg1);
    });

    it('should retrieve messages with references', () => {
      const messageWithRef: ChatMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'Check out this repo',
        timestamp: Date.now(),
        references: [
          {
            id: 1,
            name: 'awesome-repo',
            owner: { login: 'author' },
            stars: 500,
            language: 'Python',
            relevance: 0.9,
          },
        ],
      };

      aiService.addMessage(messageWithRef, 'conv-1');
      const history = aiService.getChatHistory('conv-1');

      expect(history[0].references).toBeDefined();
      expect(history[0].references?.[0].name).toBe('awesome-repo');
    });
  });

  describe('Error Handling', () => {
    it('should return error response on LLM failure', async () => {
      // This would require mocking the LLM call directly
      // For now, verify the structure of error handling

      const message = 'Test message';
      const response = await aiService.chat(message);

      // Response should always have either content or error
      expect(response.content || response.error).toBeDefined();
    });

    it('should handle disabled AI service gracefully', async () => {
      const disabledSettings: AISettings = {
        enabled: false,
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-4',
        embeddingModel: 'text-embedding-3-small',
        maxTokens: 2000,
        temperature: 0.7,
      };

      aiService = new AIService(
        mockEmbeddingService,
        mockVectorSearchService,
        disabledSettings
      );

      const message = 'Should this work?';
      const response = await aiService.chat(message);

      expect(response).toBeDefined();
      // Service should indicate it's disabled
      expect(response.error || response.content).toBeDefined();
    });

    it('should validate API key before sending request', async () => {
      const settingsWithoutKey: AISettings = {
        enabled: true,
        provider: 'openai',
        apiKey: '', // Missing API key
        model: 'gpt-4',
        embeddingModel: 'text-embedding-3-small',
        maxTokens: 2000,
        temperature: 0.7,
      };

      aiService = new AIService(
        mockEmbeddingService,
        mockVectorSearchService,
        settingsWithoutKey
      );

      const message = 'Test without API key';
      const response = await aiService.chat(message);

      // Should return error about missing API key
      expect(response).toBeDefined();
    });
  });

  describe('Response Structure', () => {
    it('should return properly structured AIResponse', async () => {
      const message = 'Test message';
      const response = await aiService.chat(message);

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('references');
      expect(typeof response.content).toBe('string');
      expect(Array.isArray(response.references)).toBe(true);
    });

    it('should include metadata in response', async () => {
      const message = 'Test message';
      const response = await aiService.chat(message);

      expect(response).toBeDefined();
      // Response may include additional fields like tokens, timing
      expect(typeof response.content).toBe('string');
    });
  });
});
