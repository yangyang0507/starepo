import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "events";
import { IPC_CHANNELS } from "@shared/constants/ipc-channels";
import type {
  IPCResponse,
  ProviderAccountConfig,
  AIResponse,
  AIChatPayload,
  ConnectionTestResult,
  ModelListResponse,
} from "@shared/types";
import type { AIProviderId } from "@shared/types/ai-provider";
import {
  createMockProviderAccount,
  createMockConnectionTestResult,
  createMockModelListResponse,
} from "../../../factories/ai-provider.factory";

class MockIpcMain extends EventEmitter {
  private handlers = new Map<string, Function>();

  handle(channel: string, handler: Function) {
    this.handlers.set(channel, handler);
  }

  async invokeHandler(channel: string, ...args: any[]) {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`No handler for channel: ${channel}`);
    }
    return handler({}, ...args);
  }

  removeHandler(channel: string) {
    this.handlers.delete(channel);
  }

  clearAllHandlers() {
    this.handlers.clear();
  }
}

const mockAIService = {
  chat: vi.fn(),
  stats: {
    totalRequests: 10,
    totalErrors: 1,
    averageLatency: 500,
  },
};

const mockProviderAccountService = {
  listAccounts: vi.fn(),
  saveAccount: vi.fn(),
  getAccount: vi.fn(),
  deleteAccount: vi.fn(),
};

const mockModelDiscoveryService = {
  getModels: vi.fn(),
  testConnection: vi.fn(),
};

vi.mock("electron", () => ({
  ipcMain: new MockIpcMain(),
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptBuffer: (buffer: Buffer) => buffer,
    decryptBuffer: (buffer: Buffer) => buffer,
  },
}));

vi.mock("@main/services/ai", () => ({
  AIService: vi.fn(() => mockAIService),
  setAIService: vi.fn(),
  getAIService: vi.fn(() => mockAIService),
}));

vi.mock("@main/services/ai/storage/provider-account-service", () => ({
  providerAccountService: mockProviderAccountService,
}));

vi.mock("@main/services/ai/discovery/model-discovery-service", () => ({
  modelDiscoveryService: mockModelDiscoveryService,
}));

vi.mock("@main/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("AI IPC Handlers - Integration Tests", () => {
  let mockIpcMain: MockIpcMain;

  beforeEach(async () => {
    vi.clearAllMocks();

    const electron = await import("electron");
    mockIpcMain = electron.ipcMain as unknown as MockIpcMain;
    mockIpcMain.clearAllHandlers();

    const { initializeAIHandlers } = await import("@main/ipc/ai-handlers");
    initializeAIHandlers();
  });

  afterEach(() => {
    mockIpcMain.clearAllHandlers();
  });

  describe("Chat Handlers", () => {
    it("should handle chat request successfully", async () => {
      const mockResponse: AIResponse = {
        content: "Hello! How can I help you?",
        references: [],
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
      };

      mockAIService.chat.mockResolvedValueOnce(mockResponse);

      const payload: AIChatPayload = {
        message: "Hello",
        conversationId: "conv-123",
        userId: "user-456",
      };

      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.CHAT,
        payload,
      );

      expect(result).toEqual({
        success: true,
        data: mockResponse,
      });
      expect(mockAIService.chat).toHaveBeenCalledWith(
        payload.message,
        payload.conversationId,
        payload.userId,
      );
    });

    it("should handle chat error gracefully", async () => {
      const errorMessage = "AI service unavailable";
      mockAIService.chat.mockRejectedValueOnce(new Error(errorMessage));

      const payload: AIChatPayload = {
        message: "Hello",
        conversationId: "conv-123",
        userId: "user-456",
      };

      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.CHAT,
        payload,
      );

      expect(result).toEqual({
        success: false,
        error: errorMessage,
      });
    });

    it("should handle stream chat request", async () => {
      const mockResponse: AIResponse = {
        content: "Streaming response",
        references: [],
        usage: {
          promptTokens: 5,
          completionTokens: 15,
          totalTokens: 20,
        },
      };

      mockAIService.chat.mockResolvedValueOnce(mockResponse);

      const payload: AIChatPayload = {
        message: "Stream this",
        conversationId: "conv-123",
        userId: "user-456",
      };

      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.CHAT_STREAM,
        payload,
      );

      expect(result).toEqual({
        success: true,
        data: mockResponse,
      });
    });
  });

  describe("Provider Handlers", () => {
    it("should get provider options successfully", async () => {
      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.GET_PROVIDER_OPTIONS,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it("should get provider list successfully", async () => {
      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.GET_PROVIDER_LIST,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });
  });

  describe("Provider Account Handlers", () => {
    it("should list provider accounts successfully", async () => {
      const mockAccounts = [
        createMockProviderAccount(),
        createMockProviderAccount({ providerId: "anthropic" as AIProviderId }),
      ];

      mockProviderAccountService.listAccounts.mockResolvedValueOnce(
        mockAccounts,
      );

      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.LIST_PROVIDER_ACCOUNTS,
      );

      expect(result).toEqual({
        success: true,
        data: mockAccounts,
      });
      expect(mockProviderAccountService.listAccounts).toHaveBeenCalledTimes(1);
    });

    it("should save provider account successfully", async () => {
      const config = createMockProviderAccount();
      mockProviderAccountService.saveAccount.mockResolvedValueOnce(undefined);

      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.SAVE_PROVIDER_ACCOUNT,
        config,
      );

      expect(result).toEqual({
        success: true,
      });
      expect(mockProviderAccountService.saveAccount).toHaveBeenCalledWith(
        config,
      );
    });

    it("should handle save provider account error", async () => {
      const config = createMockProviderAccount();
      const errorMessage = "Failed to save account";
      mockProviderAccountService.saveAccount.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.SAVE_PROVIDER_ACCOUNT,
        config,
      );

      expect(result).toEqual({
        success: false,
        error: errorMessage,
      });
    });

    it("should get provider account successfully", async () => {
      const mockAccount = createMockProviderAccount();
      mockProviderAccountService.getAccount.mockResolvedValueOnce(mockAccount);

      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.GET_PROVIDER_ACCOUNT,
        "openai" as AIProviderId,
      );

      expect(result).toEqual({
        success: true,
        data: mockAccount,
      });
      expect(mockProviderAccountService.getAccount).toHaveBeenCalledWith(
        "openai",
      );
    });

    it("should delete provider account successfully", async () => {
      mockProviderAccountService.deleteAccount.mockResolvedValueOnce(undefined);

      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.DELETE_PROVIDER_ACCOUNT,
        "openai" as AIProviderId,
      );

      expect(result).toEqual({
        success: true,
      });
      expect(mockProviderAccountService.deleteAccount).toHaveBeenCalledWith(
        "openai",
      );
    });
  });

  describe("Model Discovery Handlers", () => {
    it("should get model list successfully", async () => {
      const config = createMockProviderAccount();
      const mockModels = createMockModelListResponse();

      mockModelDiscoveryService.getModels.mockResolvedValueOnce(mockModels);

      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.GET_MODEL_LIST,
        config,
        false,
      );

      expect(result).toEqual({
        success: true,
        data: mockModels,
      });
      expect(mockModelDiscoveryService.getModels).toHaveBeenCalledWith(
        config,
        false,
      );
    });

    it("should force refresh model list", async () => {
      const config = createMockProviderAccount();
      const mockModels = createMockModelListResponse();

      mockModelDiscoveryService.getModels.mockResolvedValueOnce(mockModels);

      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.GET_MODEL_LIST,
        config,
        true,
      );

      expect(result.success).toBe(true);
      expect(mockModelDiscoveryService.getModels).toHaveBeenCalledWith(
        config,
        true,
      );
    });

    it("should handle get model list error", async () => {
      const config = createMockProviderAccount();
      const errorMessage = "Failed to fetch models";
      mockModelDiscoveryService.getModels.mockRejectedValueOnce(
        new Error(errorMessage),
      );

      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.GET_MODEL_LIST,
        config,
        false,
      );

      expect(result).toEqual({
        success: false,
        error: errorMessage,
      });
    });

    it("should test provider connection successfully", async () => {
      const config = createMockProviderAccount();
      const mockResult = createMockConnectionTestResult();

      mockModelDiscoveryService.testConnection.mockResolvedValueOnce(
        mockResult,
      );

      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.TEST_PROVIDER_CONNECTION,
        config,
      );

      expect(result).toEqual({
        success: true,
        data: mockResult,
      });
      expect(mockModelDiscoveryService.testConnection).toHaveBeenCalledWith(
        config,
      );
    });

    it("should handle connection test failure", async () => {
      const config = createMockProviderAccount();
      const mockResult = createMockConnectionTestResult({
        success: false,
        message: "Connection failed",
        error: {
          code: "INVALID_API_KEY",
          message: "Invalid API key",
          details: {},
        },
      });

      mockModelDiscoveryService.testConnection.mockResolvedValueOnce(
        mockResult,
      );

      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.TEST_PROVIDER_CONNECTION,
        config,
      );

      expect(result).toEqual({
        success: true,
        data: mockResult,
      });
      expect(mockResult.success).toBe(false);
    });
  });

  describe("Stats Handlers", () => {
    it("should get AI service stats successfully", async () => {
      const result = await mockIpcMain.invokeHandler(IPC_CHANNELS.AI.GET_STATS);

      expect(result).toEqual({
        success: true,
        data: mockAIService.stats,
      });
    });

    it("should handle get stats error", async () => {
      const { getAIService } = await import("@main/services/ai");
      vi.mocked(getAIService).mockReturnValueOnce(null as any);

      const result = await mockIpcMain.invokeHandler(IPC_CHANNELS.AI.GET_STATS);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle Error objects", async () => {
      const errorMessage = "Network timeout";
      mockAIService.chat.mockRejectedValueOnce(new Error(errorMessage));

      const payload: AIChatPayload = {
        message: "Test",
        conversationId: "conv-123",
        userId: "user-456",
      };

      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.CHAT,
        payload,
      );

      expect(result).toEqual({
        success: false,
        error: errorMessage,
      });
    });

    it("should handle string errors", async () => {
      mockAIService.chat.mockRejectedValueOnce("Simple string error");

      const payload: AIChatPayload = {
        message: "Test",
        conversationId: "conv-123",
        userId: "user-456",
      };

      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.CHAT,
        payload,
      );

      expect(result).toEqual({
        success: false,
        error: "Simple string error",
      });
    });

    it("should handle unknown errors", async () => {
      mockAIService.chat.mockRejectedValueOnce({ unknown: "error object" });

      const payload: AIChatPayload = {
        message: "Test",
        conversationId: "conv-123",
        userId: "user-456",
      };

      const result = await mockIpcMain.invokeHandler(
        IPC_CHANNELS.AI.CHAT,
        payload,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Initialization", () => {
    it("should initialize all handlers successfully", async () => {
      const expectedChannels = [
        IPC_CHANNELS.AI.CHAT,
        IPC_CHANNELS.AI.CHAT_STREAM,
        IPC_CHANNELS.AI.GET_PROVIDER_OPTIONS,
        IPC_CHANNELS.AI.GET_PROVIDER_LIST,
        IPC_CHANNELS.AI.LIST_PROVIDER_ACCOUNTS,
        IPC_CHANNELS.AI.SAVE_PROVIDER_ACCOUNT,
        IPC_CHANNELS.AI.GET_PROVIDER_ACCOUNT,
        IPC_CHANNELS.AI.DELETE_PROVIDER_ACCOUNT,
        IPC_CHANNELS.AI.GET_MODEL_LIST,
        IPC_CHANNELS.AI.TEST_PROVIDER_CONNECTION,
        IPC_CHANNELS.AI.GET_STATS,
      ];

      for (const channel of expectedChannels) {
        const testPromise = mockIpcMain.invokeHandler(channel);
        await expect(testPromise).resolves.not.toThrow();
      }
    });
  });
});
