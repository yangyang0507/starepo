/**
 * 模型列表组件
 * 显示 Provider 的可用 Chat 模型，支持添加自定义模型
 */

import { RefreshCw, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AIModel, ModelSelectionState } from "@shared/types";

interface ModelListProps {
  models: AIModel[];
  state: ModelSelectionState;
  onRefresh: () => void;
  onAddCustomModel?: () => void;
  error?: string;
}

export function ModelList({
  models,
  state,
  onRefresh,
  onAddCustomModel,
  error,
}: ModelListProps) {
  // 只显示 Chat 模型（过滤掉 Embedding 和 Rerank）
  const chatModels = models.filter(
    (model) =>
      !model.id.includes("embedding") &&
      !model.id.includes("rerank") &&
      !model.id.includes("moderation"),
  );

  return (
    <div className="space-y-3">
      {/* 标题和操作按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">模型管理</h3>
          {chatModels.length > 0 && (
            <span className="text-muted-foreground text-xs">
              ({chatModels.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onAddCustomModel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddCustomModel}
              className="h-8 px-2"
            >
              <Plus size={14} />
              <span className="ml-1">添加</span>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={state === "loading"}
            className="h-8 px-2"
          >
            <RefreshCw
              size={14}
              className={cn(state === "loading" && "animate-spin")}
            />
            <span className="ml-1">刷新</span>
          </Button>
        </div>
      </div>

      {/* 加载状态 */}
      {state === "loading" && (
        <div className="text-muted-foreground text-sm">
          正在从 API 获取模型列表...
        </div>
      )}

      {/* 错误状态 */}
      {state === "error" && (
        <div className="text-destructive text-sm">{error || "加载失败"}</div>
      )}

      {/* 空状态 - 无缓存 */}
      {(state === "idle" || state === "no-cache") &&
        chatModels.length === 0 && (
          <div className="rounded-md border border-dashed p-6 text-center">
            <p className="text-muted-foreground mb-3 text-sm">暂无模型数据</p>
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRefresh}
              >
                <RefreshCw size={14} className="mr-1" />从 API 获取
              </Button>
              {onAddCustomModel && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onAddCustomModel}
                >
                  <Plus size={14} className="mr-1" />
                  添加自定义模型
                </Button>
              )}
            </div>
          </div>
        )}

      {/* 模型列表 */}
      {(state === "success" ||
        state === "cached" ||
        (state === "idle" && chatModels.length > 0)) && (
        <>
          {chatModels.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-center">
              <p className="text-muted-foreground mb-3 text-sm">
                未找到可用的 Chat 模型
              </p>
              {onAddCustomModel && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onAddCustomModel}
                >
                  <Plus size={14} className="mr-1" />
                  添加自定义模型
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <div className="max-h-[300px] overflow-y-auto">
                {chatModels.map((model, index) => (
                  <div
                    key={model.id}
                    className={cn(
                      "flex items-start gap-3 px-3 py-2.5 text-sm",
                      index !== chatModels.length - 1 && "border-b",
                    )}
                  >
                    {/* 模型信息 */}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {model.displayName || model.id}
                      </div>
                      {model.description && (
                        <div className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                          {model.description}
                        </div>
                      )}
                      {/* 能力标签 */}
                      {model.capabilities && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {model.capabilities.supportsVision && (
                            <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                              Vision
                            </span>
                          )}
                          {model.capabilities.supportsTools && (
                            <span className="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700 dark:bg-green-950 dark:text-green-300">
                              Tools
                            </span>
                          )}
                          {model.capabilities.maxTokens && (
                            <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              {model.capabilities.maxTokens.toLocaleString()}{" "}
                              tokens
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
          {state === "cached" && (
            <div className="text-muted-foreground text-xs">
              使用缓存的模型列表，点击刷新获取最新数据
            </div>
          )}
          {state === "idle" && chatModels.length > 0 && (
            <div className="text-muted-foreground text-xs">
              使用本地缓存的模型列表
            </div>
          )}
        </>
      )}
    </div>
  );
}
