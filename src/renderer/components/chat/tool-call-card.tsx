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
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      badge: (
        <Badge variant="default" className="bg-blue-500">
          执行中
        </Badge>
      ),
      borderColor: "border-blue-500",
    },
    success: {
      icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
      badge: (
        <Badge variant="default" className="bg-green-500">
          已完成
        </Badge>
      ),
      borderColor: "border-green-500",
    },
    error: {
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      badge: <Badge variant="destructive">失败</Badge>,
      borderColor: "border-red-500",
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
    <Card className={`my-2 ${config.borderColor} border-l-4`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {config.icon}
              <span className="text-sm font-medium">{toolName}</span>
              {config.badge}
              {executionTime && (
                <span className="text-muted-foreground text-xs">
                  {executionTime}s
                </span>
              )}
            </div>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                aria-label={isOpen ? "收起" : "展开"}
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0 pb-3">
            {/* 参数 */}
            {Object.keys(args).length > 0 && (
              <div>
                <h4 className="text-muted-foreground mb-1 text-xs font-semibold">
                  参数
                </h4>
                <div className="max-h-32 overflow-auto">
                  <pre className="bg-muted rounded p-2 text-xs break-words whitespace-pre-wrap">
                    {formatJSON(args)}
                  </pre>
                </div>
              </div>
            )}

            {/* 结果 */}
            {status === "success" && result && (
              <div>
                <h4 className="text-muted-foreground mb-1 text-xs font-semibold">
                  结果
                </h4>
                <div className="max-h-48 overflow-auto">
                  <pre className="bg-muted rounded p-2 text-xs break-words whitespace-pre-wrap">
                    {formatJSON(result)}
                  </pre>
                </div>
              </div>
            )}

            {/* 错误 */}
            {status === "error" && error && (
              <div>
                <h4 className="mb-1 text-xs font-semibold text-red-500">
                  错误信息
                </h4>
                <div className="rounded bg-red-50 p-2 text-xs break-words text-red-700 dark:bg-red-950 dark:text-red-300">
                  {error}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
