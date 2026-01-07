import type {
  ProviderAccountConfig,
  AIModel,
  ConnectionTestResult,
  ModelListResponse,
  AIProviderId,
  AIProtocol,
} from "@shared/types/ai-provider";
import { AI_PROTOCOL, AI_PROVIDER_ID } from "@shared/types/ai-provider";

export function createMockProviderAccount(
  overrides?: Partial<ProviderAccountConfig>,
): ProviderAccountConfig {
  return {
    providerId: AI_PROVIDER_ID.OPENAI,
    apiKey: "test-api-key-12345",
    protocol: AI_PROTOCOL.OPENAI_COMPATIBLE,
    timeout: 30000,
    retries: 3,
    strictTLS: true,
    enabled: true,
    ...overrides,
  };
}

export function createMockAIModel(overrides?: Partial<AIModel>): AIModel {
  return {
    id: "gpt-4",
    providerId: AI_PROVIDER_ID.OPENAI,
    displayName: "GPT-4",
    description: "Most capable GPT-4 model",
    deprecated: false,
    capabilities: {
      maxTokens: 8192,
      supportsStreaming: true,
      supportsTools: true,
      supportsJsonMode: true,
      supportsVision: false,
      supportsSystemPrompt: true,
    },
    ...overrides,
  };
}

export function createMockModelListResponse(
  models?: AIModel[],
  overrides?: Partial<ModelListResponse>,
): ModelListResponse {
  return {
    models: models || [
      createMockAIModel({ id: "gpt-4" }),
      createMockAIModel({ id: "gpt-3.5-turbo", displayName: "GPT-3.5 Turbo" }),
    ],
    providerId: AI_PROVIDER_ID.OPENAI,
    fetchedAt: new Date().toISOString(),
    ttl: 3600,
    ...overrides,
  };
}

export function createMockConnectionTestResult(
  overrides?: Partial<ConnectionTestResult>,
): ConnectionTestResult {
  return {
    success: true,
    providerId: AI_PROVIDER_ID.OPENAI,
    message: "Connection successful",
    details: {
      latency: 150,
      modelCount: 2,
    },
    ...overrides,
  };
}

export function createMockProviderAccounts(): Map<
  AIProviderId,
  ProviderAccountConfig
> {
  const accounts = new Map<AIProviderId, ProviderAccountConfig>();

  accounts.set(
    AI_PROVIDER_ID.OPENAI,
    createMockProviderAccount({
      providerId: AI_PROVIDER_ID.OPENAI,
      enabled: true,
    }),
  );

  accounts.set(
    AI_PROVIDER_ID.ANTHROPIC,
    createMockProviderAccount({
      providerId: AI_PROVIDER_ID.ANTHROPIC,
      protocol: AI_PROTOCOL.ANTHROPIC,
      enabled: false,
    }),
  );

  return accounts;
}
