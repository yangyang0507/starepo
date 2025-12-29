/**
 * AI 设置页面容器组件
 * 采用左右分栏布局：左侧 Provider 列表，右侧 Provider 详细配置
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProviderList } from './provider-list';
import { ProviderSetting } from './provider-setting';
import { useAIAccountsStore } from '@/stores/ai-accounts-store';
import { getProviderList } from '@/api/ai';
import type { AIProviderId, ProviderOption } from '@shared/types';

// 骨架屏组件
function LoadingSkeleton() {
  return (
    <div className="flex h-full">
      {/* 左侧骨架 */}
      <aside className="w-60 border-r bg-muted/10 flex flex-col">
        <div className="p-4">
          <div className="h-9 bg-muted rounded-md animate-pulse" />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded-md animate-pulse" />
          ))}
        </div>
        <div className="p-4 border-t">
          <div className="h-9 bg-muted rounded-md animate-pulse" />
        </div>
      </aside>

      {/* 右侧骨架 */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-3xl mx-auto space-y-6">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted rounded-md animate-pulse" />
            <div className="h-4 w-64 bg-muted rounded-md animate-pulse" />
          </div>
          <div className="h-px bg-border" />
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-muted rounded-md animate-pulse" />
                <div className="h-10 bg-muted rounded-md animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 错误状态组件
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">加载失败</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button onClick={onRetry} variant="outline">
          重试
        </Button>
      </div>
    </div>
  );
}

// 空状态组件
function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-2 max-w-md">
        <p className="text-muted-foreground">暂无可用的 AI Provider</p>
        <p className="text-sm text-muted-foreground">
          请检查系统配置或联系管理员
        </p>
      </div>
    </div>
  );
}

export function AISettingsPage() {
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<AIProviderId | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { initAccounts } = useAIAccountsStore();
  const isInitialized = useRef(false);

  // 初始化：加载 Provider 列表和账户信息（只执行一次）
  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [providerList] = await Promise.all([
        getProviderList(),
        initAccounts(),
      ]);

      // 从 store 获取最新的账户数据（initAccounts 已更新 store）
      const { accounts: loadedAccounts, cachedConfigs: loadedConfigs } = useAIAccountsStore.getState();

      // 从账户配置中恢复自定义 Provider
      const customProviders: ProviderOption[] = [];
      for (const [providerId, metadata] of loadedAccounts.entries()) {
        // 跳过预定义的 Provider
        if (providerId.startsWith('custom-')) {
          const config = loadedConfigs.get(providerId);
          customProviders.push({
            value: providerId,
            label: metadata.name || providerId,
            iconId: config?.logo,
          });
        }
      }

      // 合并预定义 Provider 和自定义 Provider
      const allProviders = [...providerList, ...customProviders];
      setProviders(allProviders);

      // 默认选中第一个 Provider
      if (allProviders.length > 0) {
        setSelectedProviderId(allProviders[0].value);
      }

      isInitialized.current = true;
    } catch (err) {
      console.error('Failed to initialize AI settings:', err);
      setError(err instanceof Error ? err.message : '加载 AI 设置失败');
    } finally {
      setIsLoading(false);
    }
  }, [initAccounts]);

  useEffect(() => {
    if (isInitialized.current) return;
    void initialize();
  }, [initialize]);

  // 添加新的 Provider 到列表
  const handleAddProvider = useCallback((newProvider: ProviderOption) => {
    setProviders((prev) => [...prev, newProvider]);
    // 自动选中新添加的 Provider
    setSelectedProviderId(newProvider.value);
  }, []);

  // 删除 Provider
  const handleDeleteProvider = useCallback((providerId: AIProviderId) => {
    setProviders((prev) => {
      const remaining = prev.filter(p => p.value !== providerId);

      // 如果删除的是当前选中的 Provider，切换到第一个剩余的 Provider
      if (selectedProviderId === providerId) {
        setSelectedProviderId(remaining.length > 0 ? remaining[0].value : null);
      }

      return remaining;
    });
  }, [selectedProviderId]);

  // 加载状态
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // 错误状态
  if (error) {
    return <ErrorState error={error} onRetry={initialize} />;
  }

  // 空状态
  if (providers.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex h-full">
      {/* 左侧：Provider 列表 */}
      <ProviderList
        providers={providers}
        selectedProviderId={selectedProviderId}
        onSelectProvider={setSelectedProviderId}
        onAddProvider={handleAddProvider}
        onDeleteProvider={handleDeleteProvider}
      />

      {/* 右侧：Provider 详细配置 */}
      {selectedProviderId ? (
        <ProviderSetting
          providerId={selectedProviderId}
          providerName={providers.find((p) => p.value === selectedProviderId)?.label}
          key={selectedProviderId}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">请选择一个 Provider 进行配置</p>
        </div>
      )}
    </div>
  );
}
