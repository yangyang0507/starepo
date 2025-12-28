import type { AIProtocol, AIProviderId, ProviderDefinition } from '@shared/types/ai-provider';
import type { BaseAdapter } from '../adapters/base/base-adapter';

export interface ProviderRegistration {
  provider: ProviderDefinition;
  adapter: BaseAdapter;
  registeredAt: number;
  metadata?: Record<string, unknown>;
}

type RegistryEvent =
  | { type: 'provider-registered'; providerId: AIProviderId }
  | { type: 'provider-unregistered'; providerId: AIProviderId }
  | { type: 'registry-cleared' };

/**
 * 动态 Provider 注册表
 * 支持运行时注册、注销和查询 Provider
 */
export class ProviderRegistry {
  private providersByIdMap = new Map<AIProviderId, ProviderRegistration>();
  private adaptersByProtocolMap = new Map<AIProtocol, BaseAdapter>();
  private listeners: Array<(event: RegistryEvent) => void> = [];

  /**
   * 注册 Provider 和 Adapter
   */
  register(provider: ProviderDefinition, adapter: BaseAdapter): void {
    // 验证
    if (!adapter.supports(provider)) {
      throw new Error(`Adapter ${adapter.protocol} does not support provider ${provider.id}`);
    }

    // 注册 Provider
    const registration: ProviderRegistration = {
      provider,
      adapter,
      registeredAt: Date.now(),
    };

    this.providersByIdMap.set(provider.id, registration);
    this.adaptersByProtocolMap.set(provider.protocol, adapter);

    // 触发事件
    this.emit({ type: 'provider-registered', providerId: provider.id });
  }

  /**
   * 批量注册
   */
  registerBatch(registrations: Array<{ provider: ProviderDefinition; adapter: BaseAdapter }>): void {
    for (const { provider, adapter } of registrations) {
      this.register(provider, adapter);
    }
  }

  /**
   * 注销 Provider
   */
  unregister(providerId: AIProviderId): boolean {
    const registration = this.providersByIdMap.get(providerId);
    if (!registration) {
      return false;
    }

    this.providersByIdMap.delete(providerId);
    this.emit({ type: 'provider-unregistered', providerId });
    return true;
  }

  /**
   * 获取 Provider 注册信息
   */
  getRegistration(providerId: AIProviderId): ProviderRegistration | undefined {
    return this.providersByIdMap.get(providerId);
  }

  /**
   * 获取 Provider 定义
   */
  getProvider(providerId: AIProviderId): ProviderDefinition | undefined {
    return this.providersByIdMap.get(providerId)?.provider;
  }

  /**
   * 获取 Adapter
   */
  getAdapter(providerId: AIProviderId): BaseAdapter | undefined {
    return this.providersByIdMap.get(providerId)?.adapter;
  }

  /**
   * 根据协议获取 Adapter
   */
  getAdapterByProtocol(protocol: AIProtocol): BaseAdapter | undefined {
    return this.adaptersByProtocolMap.get(protocol);
  }

  /**
   * 获取所有已注册的 Provider
   */
  getAllProviders(): ProviderDefinition[] {
    return Array.from(this.providersByIdMap.values()).map((r) => r.provider);
  }

  /**
   * 检查 Provider 是否已注册
   */
  has(providerId: AIProviderId): boolean {
    return this.providersByIdMap.has(providerId);
  }

  /**
   * 清空注册表
   */
  clear(): void {
    this.providersByIdMap.clear();
    this.adaptersByProtocolMap.clear();
    this.emit({ type: 'registry-cleared' });
  }

  /**
   * 事件监听
   */
  on(listener: (event: RegistryEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private emit(event: RegistryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Registry event listener error:', error);
      }
    }
  }

  /**
   * 获取注册表统计信息
   */
  get stats() {
    return {
      totalProviders: this.providersByIdMap.size,
      totalProtocols: this.adaptersByProtocolMap.size,
      providers: Array.from(this.providersByIdMap.keys()),
    };
  }
}
