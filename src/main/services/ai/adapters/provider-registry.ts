import { getProviderDefinition } from "@shared/data/ai-providers";
import type { AIProtocol, AIProviderId, ProviderDefinition } from "@shared/types/ai-provider";
import type { BaseAdapter } from "./base-adapter";
import { AnthropicAdapter } from "./anthropic-adapter";
import { OpenAICompatibleAdapter } from "./openai-compatible-adapter";

export class ProviderRegistry {
  private adaptersByProtocol: Map<AIProtocol, BaseAdapter>;

  constructor(
    adapters: BaseAdapter[] = [
      new OpenAICompatibleAdapter(),
      new AnthropicAdapter(),
    ]
  ) {
    this.adaptersByProtocol = new Map();
    for (const adapter of adapters) {
      this.adaptersByProtocol.set(adapter.protocol, adapter);
    }
  }

  getProviderDefinitionOrThrow(providerId: AIProviderId): ProviderDefinition {
    const provider = getProviderDefinition(providerId);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }
    return provider;
  }

  getAdapterForProvider(providerId: AIProviderId): BaseAdapter {
    const provider = this.getProviderDefinitionOrThrow(providerId);
    const adapter = this.adaptersByProtocol.get(provider.protocol);
    if (!adapter) {
      throw new Error(`No adapter registered for protocol: ${provider.protocol}`);
    }
    return adapter;
  }

  getAdapterForProtocol(protocol: AIProtocol): BaseAdapter | undefined {
    return this.adaptersByProtocol.get(protocol);
  }
}

export const providerRegistry = new ProviderRegistry();