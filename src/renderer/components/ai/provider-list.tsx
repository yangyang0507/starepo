/**
 * Provider 列表组件
 * 左侧面板，显示所有可用的 AI Provider
 */

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, PlusIcon, GripVertical, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIAccountsStore } from '@/stores/ai-accounts-store';
import { useAIProviderUIStore } from '@/stores/ai-provider-ui-store';
import { AddProviderPopup, type AddProviderData } from './add-provider-popup';
import type { AIProviderId, ProviderOption } from '@shared/types';

interface ProviderListProps {
  providers: ProviderOption[];
  selectedProviderId: AIProviderId | null;
  onSelectProvider: (providerId: AIProviderId) => void;
  onAddProvider: (newProvider: ProviderOption) => void;
}

export function ProviderList({
  providers,
  selectedProviderId,
  onSelectProvider,
  onAddProvider,
}: ProviderListProps) {
  const { accounts, saveAccount } = useAIAccountsStore();
  const { searchText, setSearchText, isAddingProvider, setIsAddingProvider } = useAIProviderUIStore();

  // 过滤 Provider
  const filteredProviders = useMemo(() => {
    if (!searchText.trim()) {
      return providers;
    }

    const keywords = searchText.toLowerCase().trim();
    return providers.filter((provider) =>
      provider.label.toLowerCase().includes(keywords)
    );
  }, [providers, searchText]);

  const handleAddProvider = () => {
    setIsAddingProvider(true);
  };

  const handleConfirmAddProvider = async (data: AddProviderData) => {
    try {
      // 生成唯一的 Provider ID
      const customProviderId = `custom-${Date.now()}` as AIProviderId;

      // 保存账户配置
      await saveAccount({
        providerId: customProviderId,
        name: data.name,
        protocol: data.type,
        timeout: 30000,
        retries: 3,
        strictTLS: true,
        enabled: false,
      });

      // 创建 ProviderOption 并添加到列表
      const newProvider: ProviderOption = {
        value: customProviderId,
        label: data.name,
        isNew: false,
      };

      onAddProvider(newProvider);

      // 选中新添加的 Provider
      onSelectProvider(customProviderId);
    } catch (error) {
      console.error('[ProviderList] Error adding provider:', error);
      throw error;
    }
  };

  return (
    <>
      <aside className="w-60 border-r bg-muted/10 flex flex-col">
        {/* 搜索框 */}
        <div className="p-4">
          <div className="relative">
            <Input
              type="text"
              placeholder="搜索 Provider"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="h-9 pr-8"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setSearchText('');
                }
              }}
            />
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        {/* Provider 列表 */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-1">
            {filteredProviders.map((provider) => {
              const isActive = selectedProviderId === provider.value;
              const account = accounts.get(provider.value);
              const isConfigured = account?.hasApiKey === true;
              const isEnabled = account?.enabled === true;

              return (
                <button
                  key={provider.value}
                  onClick={() => onSelectProvider(provider.value)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    'border border-transparent',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {/* 拖拽手柄（暂不实现拖拽功能） */}
                  <GripVertical
                    size={12}
                    className={cn(
                      'opacity-0 transition-opacity',
                      !isActive && 'group-hover:opacity-100'
                    )}
                  />

                  {/* Provider 名称 */}
                  <span className="flex-1 text-left truncate">
                    {provider.label}
                  </span>

                  {/* NEW 标签 */}
                  {provider.isNew && (
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full',
                        isActive
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                      )}
                    >
                      NEW
                    </span>
                  )}

                  {/* 启用状态图标 */}
                  {isEnabled && (
                    <CheckCircle
                      size={16}
                      className={cn(
                        isActive ? 'text-primary-foreground' : 'text-green-500'
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 添加按钮 */}
        <div className="p-4 border-t">
          <Button
            onClick={handleAddProvider}
            className="w-full"
            variant="outline"
            size="sm"
          >
            <PlusIcon size={16} className="mr-2" />
            添加自定义 Provider
          </Button>
        </div>
      </aside>

      {/* 添加 Provider 弹窗 */}
      <AddProviderPopup
        open={isAddingProvider}
        onOpenChange={setIsAddingProvider}
        onConfirm={handleConfirmAddProvider}
      />
    </>
  );
}
