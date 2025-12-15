import type { LanguageModelV2 } from "@ai-sdk/provider";
import { createOpenAI } from "@ai-sdk/openai";
import {
  AI_PROTOCOL,
  type ProviderAccountConfig,
  type ProviderDefinition,
} from "@shared/types/ai-provider";
import {
  ensurePathSuffix,
  type BaseAdapter,
  type CreateLanguageModelParams,
  mergeHeaders,
  pickModelId,
  resolveBaseUrl,
} from "./base-adapter";

/**
 * Ollama Adapter
 * 原型实现：使用 Ollama 的 OpenAI 兼容接口（baseURL + /v1）
 */
export class OllamaAdapter implements BaseAdapter {
  readonly protocol = AI_PROTOCOL.OLLAMA;

  supports(provider: ProviderDefinition): boolean {
    return provider.protocol === this.protocol;
  }

  getDefaultModelId(provider: ProviderDefinition, account: ProviderAccountConfig): string {
    return pickModelId({ provider, account });
  }

  createLanguageModel(params: CreateLanguageModelParams): LanguageModelV2 {
    const { provider, account } = params;
    const modelId = pickModelId({ provider, account, requestedModelId: params.modelId });
    const baseURL = ensurePathSuffix(resolveBaseUrl(provider, account), "/v1");
    const headers = mergeHeaders({ provider, account, authHeader: null });

    const openai = createOpenAI({
      baseURL,
      headers,
      name: provider.id,
    });

    return openai(modelId);
  }
}