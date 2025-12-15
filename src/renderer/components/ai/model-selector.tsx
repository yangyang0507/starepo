/**
 * AI 模型选择器组件
 * 支持异步加载、搜索和手动输入
 */

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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

  // 检查当前值是否在模型列表中
  useEffect(() => {
    if (value && models.length > 0) {
      const exists = models.some((m) => m.id === value);
      setIsCustomInput(!exists);
      if (!exists) {
        setCustomValue(value);
      }
    }
  }, [value, models]);

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
            onChange={(e) => {
              setCustomValue(e.target.value);
              onChange(e.target.value);
            }}
            placeholder="输入模型 ID（例如：gpt-4o）"
            disabled={disabled}
            className="font-mono text-sm"
          />
          {allowCustomInput && models.length > 0 && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => setIsCustomInput(false)}
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

          <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="选择模型" />
            </SelectTrigger>
            <SelectContent>
              {filteredModels.length === 0 ? (
                <div className="p-2 text-center text-sm text-muted-foreground">
                  {searchQuery ? '未找到匹配的模型' : '暂无可用模型'}
                </div>
              ) : (
                filteredModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{model.displayName}</span>
                      {model.description && (
                        <span className="text-xs text-muted-foreground">
                          {model.description}
                        </span>
                      )}
                      {model.capabilities?.maxTokens && (
                        <span className="text-xs text-muted-foreground">
                          最大 tokens: {model.capabilities.maxTokens.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

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