/**
 * AI Provider UI 状态管理
 * 管理 Provider 列表的 UI 状态（选中、搜索、排序等）
 * 与数据状态（ai-accounts-store）分离
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIProviderId } from '@shared/types';

interface AIProviderUIStore {
  // 选中的 Provider
  selectedProviderId: AIProviderId | null;
  setSelectedProvider: (id: AIProviderId | null) => void;

  // 搜索文本
  searchText: string;
  setSearchText: (text: string) => void;

  // Provider 排序
  providerOrder: AIProviderId[];
  setProviderOrder: (order: AIProviderId[]) => void;
  reorderProvider: (fromIndex: number, toIndex: number) => void;

  // UI 状态
  isAddingProvider: boolean;
  setIsAddingProvider: (isAdding: boolean) => void;

  // 清除状态
  clearUIState: () => void;
}

export const useAIProviderUIStore = create<AIProviderUIStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      selectedProviderId: null,
      searchText: '',
      providerOrder: [],
      isAddingProvider: false,

      // 设置选中的 Provider
      setSelectedProvider: (id) => {
        set({ selectedProviderId: id });
      },

      // 设置搜索文本
      setSearchText: (text) => {
        set({ searchText: text });
      },

      // 设置 Provider 排序
      setProviderOrder: (order) => {
        set({ providerOrder: order });
      },

      // 重新排序 Provider
      reorderProvider: (fromIndex, toIndex) => {
        const { providerOrder } = get();
        const newOrder = [...providerOrder];
        const [removed] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, removed);
        set({ providerOrder: newOrder });
      },

      // 设置是否正在添加 Provider
      setIsAddingProvider: (isAdding) => {
        set({ isAddingProvider: isAdding });
      },

      // 清除 UI 状态
      clearUIState: () => {
        set({
          selectedProviderId: null,
          searchText: '',
          isAddingProvider: false,
        });
      },
    }),
    {
      name: 'ai-provider-ui-storage',
      // 只持久化部分状态
      partialize: (state) => ({
        selectedProviderId: state.selectedProviderId,
        providerOrder: state.providerOrder,
      }),
    }
  )
);
