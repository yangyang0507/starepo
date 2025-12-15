/**
 * AI Provider Adapters
 * 将不同的 AI Provider 协议适配为统一的 LanguageModelV2 接口
 */

export type { BaseAdapter, CreateLanguageModelParams } from "./base-adapter";
export {
  resolveBaseUrl,
  ensurePathSuffix,
  pickModelId,
  resolveAuthHeader,
  mergeHeaders,
} from "./base-adapter";

export { OpenAICompatibleAdapter } from "./openai-compatible-adapter";
export { AnthropicAdapter } from "./anthropic-adapter";

export { ProviderRegistry, providerRegistry } from "./provider-registry";