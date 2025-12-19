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
      for (const account of accounts) {
        accountMap.set(account.providerId, account);
      }
      set({ accounts: accountMap, isLoading: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load accounts';
      set({ error: errorMessage, isLoading: false });
    }
  },

  saveAccount: async (config: ProviderAccountConfig) => {
    set({ isLoading: true, error: null });
    try {
      await saveProviderAccount(config);

      const metadata: ProviderAccountMetadata = {
        providerId: config.providerId,
        name: config.name,
        baseUrl: config.baseUrl,
        hasApiKey: !!config.apiKey,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastUsed: Date.now(),
      };

      set((state) => {
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
}));
