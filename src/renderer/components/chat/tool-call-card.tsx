/**
 * 工具调用卡片组件
 * 展示 AI Agent 的工具调用过程
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export interface ToolCallCardProps {
  toolName: string;
  args: Record<string, unknown>;
  status: "calling" | "success" | "error";
  result?: unknown;
  error?: string;
  startedAt?: number;
  endedAt?: number;
}

export function ToolCallCard({
  toolName,
  args,
  status,
  result,
  error,
  startedAt,
  endedAt,
}: ToolCallCardProps) {
  const [isOpen, setIsOpen] = useState(
    status === "calling" || status === "error",
  );

  useEffect(() => {
    console.log("[ToolCallCard] Status changed:", {
      toolName,
      status,
      result,
      error,
    });
    if (status === "success") {
      setIsOpen(false);
    }
  }, [status, toolName, result, error]);

  // 计算执行时间
  const executionTime =
    startedAt && endedAt ? ((endedAt - startedAt) / 1000).toFixed(2) : null;

  // 状态样式
  const statusConfig = {
    calling: {
      icon: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
      badge: (
        <Badge variant="outline" className="border-blue-200 text-blue-600 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400">
          执行中
        </Badge>
      ),
    },
    success: {
      icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
      badge: (
        <Badge variant="outline" className="border-green-200 text-green-600 bg-green-50 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
          已完成
        </Badge>
      ),
    },
    error: {
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      badge: (
        <Badge variant="outline" className="border-red-200 text-red-600 bg-red-50 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          失败
        </Badge>
      ),
    },
  };

  const config = statusConfig[status];

  // 格式化 JSON
  const formatJSON = (data: unknown): string => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  return (
    <Card className="my-2 overflow-hidden border bg-card/50 backdrop-blur-sm transition-all">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50">
                {config.icon}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{toolName}</span>
                <div className="flex items-center gap-2">
                  {config.badge}
                  {executionTime && (
                    <span className="text-muted-foreground text-[10px]">
                      {executionTime}s
                    </span>
                  )}
                </div>
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-muted"
                aria-label={isOpen ? "收起" : "展开"}
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4 px-4 pb-4 pt-0">
            {/* 参数 */}
            {Object.keys(args).length > 0 ? (
              <div className="rounded-lg bg-muted/30 p-3">
                <h4 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
                  参数
                </h4>
                <div className="max-h-32 overflow-auto custom-scrollbar">
                  <pre className="font-mono text-xs text-foreground/80 break-words whitespace-pre-wrap">
                    {formatJSON(args)}
                  </pre>
                </div>
              </div>
            ) : null}

            {/* 结果 */}
            {status === "success" && result ? (
              <div className="rounded-lg bg-green-50/50 dark:bg-green-900/10 p-3">
                <h4 className="text-green-600/80 dark:text-green-400/80 mb-2 text-xs font-semibold uppercase tracking-wider">
                  结果
                </h4>
                <div className="max-h-48 overflow-auto custom-scrollbar">
                  <pre className="font-mono text-xs text-foreground/80 break-words whitespace-pre-wrap">
                    {formatJSON(result)}
                  </pre>
                </div>
              </div>
            ) : null}

            {/* 错误 */}
            {status === "error" && error ? (
              <div className="rounded-lg bg-red-50/50 dark:bg-red-900/10 p-3">
                <h4 className="text-red-600/80 dark:text-red-400/80 mb-2 text-xs font-semibold uppercase tracking-wider">
                  错误信息
                </h4>
                <div className="text-xs text-red-700 dark:text-red-300 break-words">
                  {error}
                </div>
              </div>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
