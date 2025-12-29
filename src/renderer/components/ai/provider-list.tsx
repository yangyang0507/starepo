/**
 * Provider 列表组件
 * 左侧面板，显示所有可用的 AI Provider
 */

import { useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, PlusIcon, GripVertical, CheckCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIAccountsStore } from '@/stores/ai-accounts-store';
import { useAIProviderUIStore } from '@/stores/ai-provider-ui-store';
import { AddProviderPopup, type AddProviderData } from './add-provider-popup';
import { ProviderIcon } from './provider-icon';
import type { AIProviderId, ProviderOption } from '@shared/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ProviderListProps {
  providers: ProviderOption[];
  selectedProviderId: AIProviderId | null;
  onSelectProvider: (providerId: AIProviderId) => void;
  onAddProvider: (newProvider: ProviderOption) => void;
  onDeleteProvider: (providerId: AIProviderId) => void;
}

// 可排序的 Provider 项组件
interface SortableProviderItemProps {
  provider: ProviderOption;
  isActive: boolean;
  isEnabled: boolean;
  canDelete: boolean; // 是否可以删除
  onSelect: () => void;
  onDelete: () => void;
}

function SortableProviderItem({
  provider,
  isActive,
  isEnabled,
  canDelete,
  onSelect,
  onDelete,
}: SortableProviderItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: provider.value });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <button
        onClick={onSelect}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors group',
          'border border-transparent',
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'hover:bg-muted text-muted-foreground hover:text-foreground'
        )}
      >
        {/* 拖拽手柄 */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing"
        >
          <GripVertical
            size={12}
            className={cn(
              'transition-opacity',
              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            )}
          />
        </div>

        {/* Provider Logo */}
        <div className="w-5 h-5 flex-shrink-0">
          <ProviderIcon
            providerId={provider.value}
            iconId={provider.iconId}
            size={20}
            fallbackIcon={provider.icon}
          />
        </div>

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

        {/* 删除按钮（仅自定义 Provider） */}
        {canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className={cn(
              'opacity-0 group-hover:opacity-100 transition-opacity',
              'hover:text-destructive',
              isActive && 'text-primary-foreground hover:text-red-200'
            )}
            title="删除 Provider"
          >
            <Trash2 size={14} />
          </button>
        )}
      </button>
    </div>
  );
}

export function ProviderList({
  providers,
  selectedProviderId,
  onSelectProvider,
  onAddProvider,
  onDeleteProvider,
}: ProviderListProps) {
  const { accounts, saveAccount, deleteAccount } = useAIAccountsStore();
  const { searchText, setSearchText, isAddingProvider, setIsAddingProvider, providerOrder, setProviderOrder } = useAIProviderUIStore();

  // 初始化 Provider 顺序
  useEffect(() => {
    if (providerOrder.length === 0 && providers.length > 0) {
      setProviderOrder(providers.map(p => p.value));
    }
  }, [providers, providerOrder.length, setProviderOrder]);

  // 配置拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 移动 8px 后才开始拖拽
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 根据保存的顺序排序 Provider
  const sortedProviders = useMemo(() => {
    if (providerOrder.length === 0) return providers;

    const orderMap = new Map(providerOrder.map((id, index) => [id, index]));
    return [...providers].sort((a, b) => {
      const aIndex = orderMap.get(a.value) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = orderMap.get(b.value) ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });
  }, [providers, providerOrder]);

  // 过滤 Provider
  const filteredProviders = useMemo(() => {
    if (!searchText.trim()) {
      return sortedProviders;
    }

    const keywords = searchText.toLowerCase().trim();
    return sortedProviders.filter((provider) =>
      provider.label.toLowerCase().includes(keywords)
    );
  }, [sortedProviders, searchText]);

  // 处理拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedProviders.findIndex(p => p.value === active.id);
      const newIndex = sortedProviders.findIndex(p => p.value === over.id);

      const newOrder = arrayMove(sortedProviders, oldIndex, newIndex).map(p => p.value);
      setProviderOrder(newOrder);
    }
  };

  const handleAddProvider = () => {
    setIsAddingProvider(true);
  };

  // 处理删除 Provider
  const handleDeleteProvider = async (providerId: AIProviderId) => {
    try {
      await deleteAccount(providerId);
      onDeleteProvider(providerId);
    } catch (error) {
      console.error('[ProviderList] Error deleting provider:', error);
      throw error;
    }
  };

  const handleConfirmAddProvider = async (data: AddProviderData) => {
    try {
      // 生成唯一的 Provider ID
      const customProviderId = `custom-${Date.now()}` as AIProviderId;

      // 保存账户配置（保存 iconId 而非 logo）
      await saveAccount({
        providerId: customProviderId,
        name: data.name,
        logo: data.iconId, // 将 iconId 存储在 logo 字段中（兼容现有存储）
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
        description: '自定义 AI Provider',
        iconId: data.iconId, // 使用 iconId
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredProviders.map(p => p.value)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {filteredProviders.map((provider) => {
                  const isActive = selectedProviderId === provider.value;
                  const account = accounts.get(provider.value);
                  const isEnabled = account?.enabled === true;
                  // 只有自定义 Provider（以 'custom-' 开头）才能删除
                  const canDelete = provider.value.startsWith('custom-');

                  return (
                    <SortableProviderItem
                      key={provider.value}
                      provider={provider}
                      isActive={isActive}
                      isEnabled={isEnabled}
                      canDelete={canDelete}
                      onSelect={() => onSelectProvider(provider.value)}
                      onDelete={() => handleDeleteProvider(provider.value)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
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
