/**
 * AI 模型选择器组件
 * 使用原生 select 提供可靠的下拉选择体验
 */

import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIModel, ModelSelectionState } from '@shared/types';

interface ModelSelectorProps {
  models: AIModel[];
  value: string;
  onChange: (modelId: string) => void;
  onRefresh?: () => void;
  state: ModelSelectionState;
  error?: string;
  disabled?: boolean;
  allowCustomInput?: boolean;
}

export function ModelSelector({
  models,
  value,
  onChange,
  onRefresh,
  state,
  error,
  disabled = false,
  allowCustomInput = true,
}: ModelSelectorProps) {
  const [isCustomInput, setIsCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 过滤模型列表
  const filteredModels = React.useMemo(() => {
    if (!searchQuery) return models;
    const query = searchQuery.toLowerCase();
    return models.filter(
      (model) =>
        model.id.toLowerCase().includes(query) ||
        model.displayName.toLowerCase().includes(query) ||
        model.description?.toLowerCase().includes(query)
    );
  }, [models, searchQuery]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    if (newValue === '__custom__') {
      setIsCustomInput(true);
      setCustomValue(value);
    } else {
      onChange(newValue);
    }
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomValue(e.target.value);
    onChange(e.target.value);
  };

  const handleSwitchToSelect = () => {
    setIsCustomInput(false);
    setSearchQuery('');
    if (value && !models.some((m) => m.id === value)) {
      onChange(models[0]?.id || '');
    }
  };

  // 渲染状态指示器
  const renderStateIndicator = () => {
    switch (state) {
      case 'loading':
        return (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>正在加载模型列表...</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error || '加载失败'}</span>
          </div>
        );
      case 'cached':
        return (
          <div className="text-xs text-muted-foreground">
            使用缓存的模型列表
          </div>
        );
      default:
        return null;
    }
  };

  // 推荐模型标记
  const RecommendedBadge = () => (
    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
      推荐
    </span>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">模型</Label>
        {onRefresh && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={disabled || state === 'loading'}
            className="h-8 px-2"
          >
            <RefreshCw
              className={cn('h-4 w-4', state === 'loading' && 'animate-spin')}
            />
            <span className="ml-1">刷新</span>
          </Button>
        )}
      </div>

      {renderStateIndicator()}

      {isCustomInput ? (
        <div className="space-y-2">
          <Input
            type="text"
            value={customValue}
            onChange={handleCustomInputChange}
            placeholder="输入模型 ID（例如：gpt-4o）"
            disabled={disabled}
            className="font-mono text-sm"
          />
          {allowCustomInput && models.length > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={handleSwitchToSelect}
              className="h-auto p-0 text-xs"
            >
              从列表中选择
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {models.length > 5 && (
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索模型..."
              disabled={disabled}
              className="text-sm"
            />
          )}

          <div className="relative">
            <select
              value={value}
              onChange={handleSelectChange}
              disabled={disabled || state === 'loading'}
              className={cn(
                'w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'cursor-pointer'
              )}
              style={{
                minHeight: '42px',
                paddingRight: '32px',
              }}
            >
              <option value="" disabled>
                选择模型
              </option>
              {filteredModels.length === 0 ? (
                <option value="" disabled>
                  {searchQuery ? '未找到匹配的模型' : '暂无可用模型'}
                </option>
              ) : (
                filteredModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName}
                    {model.description ? ` - ${model.description.slice(0, 50)}` : ''}
                  </option>
                ))
              )}
              {allowCustomInput && (
                <option value="__custom__" className="italic text-muted-foreground">
                  ─ 手动输入模型 ID ─
                </option>
              )}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
              <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {allowCustomInput && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => {
                setIsCustomInput(true);
                setCustomValue(value);
              }}
              className="h-auto p-0 text-xs"
            >
              手动输入模型 ID
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
