import type { LanguageModelV2 } from "@ai-sdk/provider";
import { createAnthropic } from "@ai-sdk/anthropic";
import {
  AI_PROTOCOL,
  AUTH_TYPES,
  type ProviderAccountConfig,
  type ProviderDefinition,
} from "@shared/types/ai-provider";
import {
  type BaseAdapter,
  type CreateLanguageModelParams,
  mergeHeaders,
  pickModelId,
  resolveAuthHeader,
  resolveBaseUrl,
} from "./base-adapter";

export class AnthropicAdapter implements BaseAdapter {
  readonly protocol = AI_PROTOCOL.ANTHROPIC;

  supports(provider: ProviderDefinition): boolean {
    return provider.protocol === this.protocol;
  }

  getDefaultModelId(provider: ProviderDefinition, account: ProviderAccountConfig): string {
    return pickModelId({ provider, account });
  }

  createLanguageModel(params: CreateLanguageModelParams): LanguageModelV2 {
    const { provider, account } = params;
    const modelId = pickModelId({ provider, account, requestedModelId: params.modelId });
    const baseURL = this.normalizeBaseUrl(resolveBaseUrl(provider, account));

    const passApiKey =
      provider.auth.type === AUTH_TYPES.API_KEY_HEADER &&
      (provider.auth.keyHeader ?? "x-api-key").toLowerCase() === "x-api-key";

    const authHeader = passApiKey ? null : resolveAuthHeader(provider, account.apiKey);
    const headers = mergeHeaders({ provider, account, authHeader });

    const anthropic = createAnthropic({
      apiKey: passApiKey ? account.apiKey : undefined,
      baseURL,
      headers,
    });

    return anthropic(modelId);
  }

  private normalizeBaseUrl(baseUrl: string): string {
    const normalized = baseUrl.replace(/\/+$/, "");
    return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
  }
}