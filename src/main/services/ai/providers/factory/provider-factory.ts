import type { LanguageModelV2 } from '@ai-sdk/provider';
import type { AIProviderId, ProviderAccountConfig } from '@shared/types/ai-provider';
import { ProviderRegistry } from '../registry/provider-registry';
import { ModelResolver } from '../../core/models/model-resolver';
import { MiddlewareChain } from '../../core/middleware/middleware-chain';

export interface ProviderFactoryOptions {
  registry: ProviderRegistry;
  modelResolver?: ModelResolver;
  middlewareChain?: MiddlewareChain;
  accountProvider?: (providerId: AIProviderId) => Promise<ProviderAccountConfig | null>;
}

/**
 * Provider 工厂
 * 负责创建语言模型实例，支持命名空间解析和中间件
 */
export class ProviderFactory {
  private registry: ProviderRegistry;
  private modelResolver: ModelResolver;
  private middlewareChain: MiddlewareChain;
  private accountProvider?: (providerId: AIProviderId) => Promise<ProviderAccountConfig | null>;

  constructor(options: ProviderFactoryOptions) {
    this.registry = options.registry;
    this.modelResolver = options.modelResolver || new ModelResolver();
    this.middlewareChain = options.middlewareChain || new MiddlewareChain();
    this.accountProvider = options.accountProvider;
  }

  /**
   * 创建语言模型实例
   * 支持命名空间格式: "provider|model"
   */
  async createLanguageModel(input: string): Promise<LanguageModelV2> {
    // 1. 解析模型命名空间
    const resolution = await this.modelResolver.resolve(input, this.accountProvider);

    // 2. 获取 Adapter
    const adapter = this.registry.getAdapter(resolution.provider.id);
    if (!adapter) {
      throw new Error(`No adapter registered for provider: ${resolution.provider.id}`);
    }

    // 3. 创建模型实例
    const model = adapter.createLanguageModel({
      provider: resolution.provider,
      account: resolution.account,
      modelId: resolution.modelId,
    });

    // 4. 应用中间件（如果需要）
    // TODO: 包装模型实例以支持中间件
    // 目前直接返回原始模型

    return model;
  }

  /**
   * 使用指定的 Provider 和账户创建模型
   */
  async createLanguageModelWithAccount(
    providerId: AIProviderId,
    account: ProviderAccountConfig,
    modelId?: string
  ): Promise<LanguageModelV2> {
    // 1. 获取 Provider 定义
    const provider = this.registry.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider not registered: ${providerId}`);
    }

    // 2. 获取 Adapter
    const adapter = this.registry.getAdapter(providerId);
    if (!adapter) {
      throw new Error(`No adapter registered for provider: ${providerId}`);
    }

    // 3. 创建模型实例
    const model = adapter.createLanguageModel({
      provider,
      account,
      modelId,
    });

    return model;
  }

  /**
   * 获取中间件链（用于外部配置）
   */
  getMiddlewareChain(): MiddlewareChain {
    return this.middlewareChain;
  }

  /**
   * 获取模型解析器（用于外部配置）
   */
  getModelResolver(): ModelResolver {
    return this.modelResolver;
  }
}
