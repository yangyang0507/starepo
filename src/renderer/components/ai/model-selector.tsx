/**
 * AI 模型选择器组件
 * 使用 Shadcn Select 提供优雅的下拉选择体验
 */

import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from '@/components/ui/select';
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

  const handleValueChange = (newValue: string) => {
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

  // 获取当前选中模型的显示名称
  const getSelectedModelDisplay = () => {
    const selectedModel = models.find((m) => m.id === value);
    return selectedModel?.displayName || value || '选择模型';
  };

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

          <Select
            value={value}
            onValueChange={handleValueChange}
            disabled={disabled || state === 'loading'}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择模型">
                {getSelectedModelDisplay()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {filteredModels.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {searchQuery ? '未找到匹配的模型' : '暂无可用模型'}
                </div>
              ) : (
                filteredModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{model.displayName}</span>
                      {model.description && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {model.description}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
              {allowCustomInput && models.length > 0 && (
                <>
                  <SelectSeparator />
                  <SelectItem value="__custom__">
                    <span className="italic text-muted-foreground">手动输入模型 ID</span>
                  </SelectItem>
                </>
              )}
            </SelectContent>
          </Select>

          {allowCustomInput && !models.length && (
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
