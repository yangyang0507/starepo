import type { AIProviderId, ProviderDefinition, ProviderAccountConfig } from '@shared/types/ai-provider';
import { parseModelNamespace, type ModelNamespace } from './model-namespace';
import { getProviderDefinition } from '@shared/data/ai-providers';

export interface ModelResolutionResult {
  provider: ProviderDefinition;
  account: ProviderAccountConfig;
  modelId: string;
  namespace: ModelNamespace;
}

export interface ModelResolverOptions {
  fallbackProvider?: AIProviderId;
  fallbackModel?: string;
  strictMode?: boolean;
}

/**
 * 模型解析器
 * 负责解析模型命名空间并返回完整的解析结果
 */
export class ModelResolver {
  constructor(private options: ModelResolverOptions = {}) {}

  /**
   * 解析模型命名空间并返回完整的解析结果
   */
  async resolve(
    input: string,
    accountProvider?: (providerId: AIProviderId) => Promise<ProviderAccountConfig | null>
  ): Promise<ModelResolutionResult> {
    const namespace = parseModelNamespace(input);

    // 1. 确定 Provider
    let providerId: AIProviderId;
    if (namespace.provider) {
      providerId = namespace.provider as AIProviderId;
    } else if (this.options.fallbackProvider) {
      providerId = this.options.fallbackProvider;
    } else {
      throw new Error(`Cannot determine provider for model: ${input}`);
    }

    // 2. 获取 Provider 定义
    const provider = getProviderDefinition(providerId);
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    // 3. 获取账户配置
    let account: ProviderAccountConfig | null = null;
    if (accountProvider) {
      account = await accountProvider(providerId);
    }

    if (!account) {
      if (this.options.strictMode) {
        throw new Error(`No account configured for provider: ${providerId}`);
      }
      account = this.createDefaultAccount(provider);
    }

    // 4. 确定模型 ID
    const modelId = this.resolveModelId(namespace, provider, account);

    return {
      provider,
      account,
      modelId,
      namespace,
    };
  }

  /**
   * 解析模型 ID（带回退逻辑）
   */
  private resolveModelId(
    namespace: ModelNamespace,
    provider: ProviderDefinition,
    account: ProviderAccountConfig
  ): string {
    // 优先级:
    // 1. 命名空间中的模型
    // 2. 账户默认模型
    // 3. Provider 推荐模型
    // 4. Provider 默认模型列表第一个
    // 5. 全局回退模型

    if (namespace.model) {
      return namespace.model;
    }

    if (account.defaultModel) {
      return account.defaultModel;
    }

    if (provider.defaults.recommendedModel) {
      return provider.defaults.recommendedModel;
    }

    if (provider.defaults.models && provider.defaults.models.length > 0) {
      return provider.defaults.models[0];
    }

    if (this.options.fallbackModel) {
      return this.options.fallbackModel;
    }

    throw new Error(`Cannot determine model ID for provider: ${provider.id}`);
  }

  /**
   * 创建默认账户配置
   */
  private createDefaultAccount(provider: ProviderDefinition): ProviderAccountConfig {
    return {
      providerId: provider.id,
      baseUrl: provider.defaults.baseUrl,
      timeout: 30000,
      retries: 3,
      strictTLS: true,
      enabled: true,
    };
  }

  /**
   * 验证模型是否存在
   */
  async validateModel(modelId: string, provider: ProviderDefinition): Promise<boolean> {
    // 如果 Provider 支持模型列表，可以进行验证
    if (provider.validation.supportsModelListing) {
      // TODO: 调用模型发现服务验证
      return true;
    }

    // 宽松模式：检查是否在默认列表中
    if (provider.validation.modelValidation === 'lenient') {
      return provider.defaults.models?.includes(modelId) ?? true;
    }

    // 严格模式：必须在列表中
    if (provider.validation.modelValidation === 'strict') {
      return provider.defaults.models?.includes(modelId) ?? false;
    }

    // 无验证模式
    return true;
  }
}
