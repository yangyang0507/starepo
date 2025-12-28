import type { LanguageModelV2 } from "@ai-sdk/provider";
import { createOpenAI } from "@ai-sdk/openai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import {
  AI_PROTOCOL,
  AI_PROVIDER_ID,
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
} from "./base/base-adapter";

export class OpenAICompatibleAdapter implements BaseAdapter {
  readonly protocol = AI_PROTOCOL.OPENAI_COMPATIBLE;

  supports(provider: ProviderDefinition): boolean {
    return provider.protocol === this.protocol;
  }

  getDefaultModelId(provider: ProviderDefinition, account: ProviderAccountConfig): string {
    return pickModelId({ provider, account });
  }

  createLanguageModel(params: CreateLanguageModelParams): LanguageModelV2 {
    const { provider, account } = params;
    const modelId = pickModelId({ provider, account, requestedModelId: params.modelId });
    const baseURL = resolveBaseUrl(provider, account);

    const passApiKey =
      provider.auth.type === AUTH_TYPES.BEARER_TOKEN &&
      (provider.auth.keyHeader ?? "Authorization").toLowerCase() === "authorization";

    const authHeader = passApiKey ? null : resolveAuthHeader(provider, account.apiKey);
    const headers = mergeHeaders({ provider, account, authHeader });

    if (provider.id === AI_PROVIDER_ID.DEEPSEEK) {
      const deepseek = createDeepSeek({
        apiKey: passApiKey ? account.apiKey : undefined,
        baseURL,
        headers,
      });
      return deepseek(modelId);
    }

    const openai = createOpenAI({
      apiKey: passApiKey ? account.apiKey : undefined,
      baseURL,
      headers,
      name: provider.id,
    });

    return openai(modelId);
  }
}