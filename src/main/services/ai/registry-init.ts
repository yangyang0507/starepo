import { ProviderRegistry } from './providers/registry/provider-registry';
import { OpenAICompatibleAdapter } from './providers/adapters/openai-compatible-adapter';
import { AnthropicAdapter } from './providers/adapters/anthropic-adapter';
import {
  OPENAI_PROVIDER,
  ANTHROPIC_PROVIDER,
  DEEPSEEK_PROVIDER,
} from '@shared/data/ai-providers';

/**
 * 创建并初始化全局 Provider 注册表
 */
export function createProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();

  // 创建适配器实例
  const openaiAdapter = new OpenAICompatibleAdapter();
  const anthropicAdapter = new AnthropicAdapter();

  // 注册 Provider
  registry.register(OPENAI_PROVIDER, openaiAdapter);
  registry.register(ANTHROPIC_PROVIDER, anthropicAdapter);
  registry.register(DEEPSEEK_PROVIDER, openaiAdapter); // DeepSeek 使用 OpenAI 兼容适配器

  return registry;
}

// 全局单例注册表
export const globalProviderRegistry = createProviderRegistry();
