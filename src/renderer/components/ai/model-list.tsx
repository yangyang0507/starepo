/**
 * 模型列表组件
 * 显示 Provider 的可用 Chat 模型（只读）
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AIModel, ModelSelectionState } from '@shared/types';

interface ModelListProps {
  models: AIModel[];
  state: ModelSelectionState;
  onRefresh: () => void;
  error?: string;
}

export function ModelList({ models, state, onRefresh, error }: ModelListProps) {
  // 只显示 Chat 模型（过滤掉 Embedding 和 Rerank）
  const chatModels = models.filter(
    (model) =>
      !model.id.includes('embedding') &&
      !model.id.includes('rerank') &&
      !model.id.includes('moderation')
  );

  if (state === 'idle') {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* 标题和刷新按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">可用模型</h3>
          {chatModels.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({chatModels.length})
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={state === 'loading'}
          className="h-8 px-2"
        >
          <RefreshCw
            size={14}
            className={cn(state === 'loading' && 'animate-spin')}
          />
          <span className="ml-1">刷新</span>
        </Button>
      </div>

      {/* 状态提示 */}
      {state === 'loading' && (
        <div className="text-sm text-muted-foreground">
          正在加载模型列表...
        </div>
      )}

      {state === 'error' && (
        <div className="text-sm text-destructive">
          {error || '加载失败'}
        </div>
      )}

      {/* 模型列表 */}
      {(state === 'success' || state === 'cached') && (
        <>
          {chatModels.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              未找到可用的 Chat 模型
            </div>
          ) : (
            <div className="rounded-md border">
              <div className="max-h-[300px] overflow-y-auto">
                {chatModels.map((model, index) => (
                  <div
                    key={model.id}
                    className={cn(
                      'flex items-start gap-3 px-3 py-2.5 text-sm',
                      index !== chatModels.length - 1 && 'border-b'
                    )}
                  >
                    {/* 模型信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {model.displayName || model.id}
                      </div>
                      {model.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {model.description}
                        </div>
                      )}
                      {/* 能力标签 */}
                      {model.capabilities && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {model.capabilities.supportsVision && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              Vision
                            </span>
                          )}
                          {model.capabilities.supportsTools && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                              Tools
                            </span>
                          )}
                          {model.capabilities.maxTokens && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              {model.capabilities.maxTokens.toLocaleString()} tokens
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 缓存提示 */}
          {state === 'cached' && (
            <div className="text-xs text-muted-foreground">
              使用缓存的模型列表，点击刷新获取最新数据
            </div>
          )}
        </>
      )}
    </div>
  );
}
