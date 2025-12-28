/**
 * AI 设置页面容器组件
 * 采用左右分栏布局：左侧 Provider 列表，右侧 Provider 详细配置
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ProviderList } from './provider-list';
import { ProviderSetting } from './provider-setting';
import { useAIAccountsStore } from '@/stores/ai-accounts-store';
import { getProviderList } from '@/api/ai';
import type { AIProviderId, ProviderOption } from '@shared/types';

export function AISettingsPage() {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<AIProviderId | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { initAccounts } = useAIAccountsStore();
  const isInitialized = useRef(false);

  // 初始化：加载 Provider 列表和账户信息（只执行一次）
  useEffect(() => {
    if (isInitialized.current) return;

    const initialize = async () => {
      try {
        setIsLoading(true);
        const [providerList] = await Promise.all([
          getProviderList(),
          initAccounts(),
        ]);
        setProviders(providerList);

        // 默认选中第一个 Provider
        if (providerList.length > 0) {
          setSelectedProviderId(providerList[0].value);
        }

        isInitialized.current = true;
      } catch (error) {
        console.error('Failed to initialize AI settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void initialize();
  }, [initAccounts]);

  // 添加新的 Provider 到列表
  const handleAddProvider = useCallback((newProvider: ProviderOption) => {
    setProviders((prev) => [...prev, newProvider]);
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">正在加载 AI 设置...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* 左侧：Provider 列表 */}
      <ProviderList
        providers={providers}
        selectedProviderId={selectedProviderId}
        onSelectProvider={setSelectedProviderId}
        onAddProvider={handleAddProvider}
      />

      {/* 右侧：Provider 详细配置 */}
      {selectedProviderId && (
        <ProviderSetting
          providerId={selectedProviderId}
          providerName={providers.find((p) => p.value === selectedProviderId)?.label}
          key={selectedProviderId}
        />
      )}
    </div>
  );
}
