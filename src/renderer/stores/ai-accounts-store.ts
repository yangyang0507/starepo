/**
 * AI Provider 账户状态管理
 */

import { create } from 'zustand';
import {
  saveProviderAccount,
  getProviderAccount,
  deleteProviderAccount,
  listProviderAccounts,
} from '@/api/ai';
import type { ProviderAccountConfig, ProviderAccountMetadata, AIProviderId } from '@shared/types';

interface AIAccountsStore {
  accounts: Map<AIProviderId, ProviderAccountMetadata>;
  cachedConfigs: Map<AIProviderId, ProviderAccountConfig>;
  isLoading: boolean;
  error: string | null;

  // 初始化加载所有账户
  initAccounts: () => Promise<void>;

  // 保存或更新账户配置
  saveAccount: (config: ProviderAccountConfig) => Promise<void>;

  // 获取账户配置
  getAccount: (providerId: AIProviderId) => Promise<ProviderAccountConfig | null>;

  // 删除账户
  deleteAccount: (providerId: AIProviderId) => Promise<void>;

  // 检查是否有已保存的账户
  hasAccount: (providerId: AIProviderId) => boolean;

  // 获取已配置的 Provider ID 列表
  getConfiguredProviders: () => AIProviderId[];

  // 清除错误
  clearError: () => void;

  // 禁用除指定 Provider 外的所有 Provider
  disableOtherProviders: (activeProviderId: AIProviderId) => Promise<void>;

  // 新增功能：刷新账户
  refreshAccount: (providerId: AIProviderId) => Promise<void>;

  // 新增功能：批量更新账户
  batchUpdateAccounts: (configs: ProviderAccountConfig[]) => Promise<void>;

  // 新增功能：清除缓存
  clearCache: () => void;

  // 新增功能：获取缓存统计
  getCacheStats: () => { size: number; providers: AIProviderId[] };
}

export const useAIAccountsStore = create<AIAccountsStore>((set, get) => ({
  accounts: new Map(),
  cachedConfigs: new Map(),
  isLoading: false,
  error: null,

  initAccounts: async () => {
    set({ isLoading: true, error: null });
    try {
      const accounts = await listProviderAccounts();
      const accountMap = new Map<AIProviderId, ProviderAccountMetadata>();
      const configMap = new Map<AIProviderId, ProviderAccountConfig>();

      // 加载每个账户的完整配置
      for (const metadata of accounts) {
        accountMap.set(metadata.providerId, metadata);

        // 加载完整配置（包括 logo）
        try {
          const config = await getProviderAccount(metadata.providerId);
          if (config) {
            configMap.set(metadata.providerId, config);
          }
        } catch (err) {
          console.warn(`Failed to load config for ${metadata.providerId}:`, err);
        }
      }

      set({ accounts: accountMap, cachedConfigs: configMap, isLoading: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load accounts';
      set({ error: errorMessage, isLoading: false });
    }
  },

  saveAccount: async (config: ProviderAccountConfig) => {
    set({ isLoading: true, error: null });
    try {
      await saveProviderAccount(config);

      set((state) => {
        const existingMetadata = state.accounts.get(config.providerId);
        const metadata: ProviderAccountMetadata = {
          providerId: config.providerId,
          name: config.name,
          baseUrl: config.baseUrl,
          hasApiKey: !!config.apiKey,
          enabled: config.enabled,
          createdAt: existingMetadata?.createdAt || Date.now(),
          updatedAt: Date.now(),
          lastUsed: Date.now(),
        };

        const newAccounts = new Map(state.accounts);
        newAccounts.set(config.providerId, metadata);

        const newConfigs = new Map(state.cachedConfigs);
        newConfigs.set(config.providerId, config);

        return { accounts: newAccounts, cachedConfigs: newConfigs, isLoading: false };
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save account';
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  getAccount: async (providerId: AIProviderId) => {
    const { cachedConfigs } = get();
    if (cachedConfigs.has(providerId)) {
      return cachedConfigs.get(providerId) || null;
    }

    try {
      const config = await getProviderAccount(providerId);
      if (config) {
        set((state) => {
          const newConfigs = new Map(state.cachedConfigs);
          newConfigs.set(providerId, config);
          return { cachedConfigs: newConfigs };
        });
      }
      return config;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get account';
      set({ error: errorMessage });
      return null;
    }
  },

  deleteAccount: async (providerId: AIProviderId) => {
    set({ isLoading: true, error: null });
    try {
      await deleteProviderAccount(providerId);

      set((state) => {
        const newAccounts = new Map(state.accounts);
        newAccounts.delete(providerId);

        const newConfigs = new Map(state.cachedConfigs);
        newConfigs.delete(providerId);

        return { accounts: newAccounts, cachedConfigs: newConfigs, isLoading: false };
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete account';
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  hasAccount: (providerId: AIProviderId) => {
    return get().accounts.has(providerId);
  },

  getConfiguredProviders: () => {
    return Array.from(get().accounts.keys());
  },

  clearError: () => {
    set({ error: null });
  },

  disableOtherProviders: async (activeProviderId: AIProviderId) => {
    const { cachedConfigs, accounts } = get();

    for (const [providerId, metadata] of accounts) {
      if (providerId !== activeProviderId && metadata.hasApiKey) {
        const config = cachedConfigs.get(providerId);
        if (config) {
          try {
            await saveProviderAccount({ ...config, enabled: false });
            // Update local state - both cachedConfigs and accounts
            set((state) => {
              const newConfigs = new Map(state.cachedConfigs);
              newConfigs.set(providerId, { ...config, enabled: false });

              const newAccounts = new Map(state.accounts);
              newAccounts.set(providerId, { ...metadata, enabled: false });

              return { cachedConfigs: newConfigs, accounts: newAccounts };
            });
          } catch (err) {
            console.error(`Failed to disable provider ${providerId}:`, err);
          }
        }
      }
    }
  },

  // 新增功能：刷新账户
  refreshAccount: async (providerId: AIProviderId) => {
    try {
      const config = await getProviderAccount(providerId);
      if (config) {
        set((state) => {
          const newConfigs = new Map(state.cachedConfigs);
          newConfigs.set(providerId, config);

          // 同时更新 metadata
          const metadata: ProviderAccountMetadata = {
            providerId: config.providerId,
            name: config.name,
            baseUrl: config.baseUrl,
            hasApiKey: !!config.apiKey,
            enabled: config.enabled,
            createdAt: state.accounts.get(providerId)?.createdAt || Date.now(),
            updatedAt: Date.now(),
            lastUsed: Date.now(),
          };

          const newAccounts = new Map(state.accounts);
          newAccounts.set(providerId, metadata);

          return { cachedConfigs: newConfigs, accounts: newAccounts };
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh account';
      set({ error: errorMessage });
      throw err;
    }
  },

  // 新增功能：批量更新账户
  batchUpdateAccounts: async (configs: ProviderAccountConfig[]) => {
    set({ isLoading: true, error: null });
    try {
      // 并行保存所有配置
      await Promise.all(configs.map((config) => saveProviderAccount(config)));

      // 更新本地状态
      set((state) => {
        const newAccounts = new Map(state.accounts);
        const newConfigs = new Map(state.cachedConfigs);

        for (const config of configs) {
          const existingMetadata = state.accounts.get(config.providerId);
          const metadata: ProviderAccountMetadata = {
            providerId: config.providerId,
            name: config.name,
            baseUrl: config.baseUrl,
            hasApiKey: !!config.apiKey,
            enabled: config.enabled,
            createdAt: existingMetadata?.createdAt || Date.now(),
            updatedAt: Date.now(),
            lastUsed: Date.now(),
          };

          newAccounts.set(config.providerId, metadata);
          newConfigs.set(config.providerId, config);
        }

        return { accounts: newAccounts, cachedConfigs: newConfigs, isLoading: false };
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to batch update accounts';
      set({ error: errorMessage, isLoading: false });
      throw err;
    }
  },

  // 新增功能：清除缓存
  clearCache: () => {
    set({ cachedConfigs: new Map() });
  },

  // 新增功能：获取缓存统计
  getCacheStats: () => {
    const { cachedConfigs } = get();
    return {
      size: cachedConfigs.size,
      providers: Array.from(cachedConfigs.keys()),
    };
  },
}));
