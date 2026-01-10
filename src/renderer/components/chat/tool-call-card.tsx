/**
 * 工具调用卡片组件
 * 展示 AI Agent 的工具调用过程
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export interface ToolCallCardProps {
  toolName: string;
  args: Record<string, unknown>;
  status: 'calling' | 'success' | 'error';
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
  // 根据状态决定默认展开状态
  const [isOpen, setIsOpen] = useState(status === 'calling' || status === 'error');

  // 计算执行时间
  const executionTime =
    startedAt && endedAt ? ((endedAt - startedAt) / 1000).toFixed(2) : null;

  // 状态样式
  const statusConfig = {
    calling: {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
      badge: <Badge variant="default" className="bg-blue-500">执行中</Badge>,
      borderColor: 'border-blue-500',
    },
    success: {
      icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
      badge: <Badge variant="default" className="bg-green-500">已完成</Badge>,
      borderColor: 'border-green-500',
    },
    error: {
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      badge: <Badge variant="destructive">失败</Badge>,
      borderColor: 'border-red-500',
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
              <span className="font-medium text-sm">{toolName}</span>
              {config.badge}
              {executionTime && (
                <span className="text-xs text-muted-foreground">
                  {executionTime}s
                </span>
              )}
            </div>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                aria-label={isOpen ? '收起' : '展开'}
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
          <CardContent className="pt-0 pb-3 space-y-3">
            {/* 参数 */}
            {Object.keys(args).length > 0 && (
              <div>
                <h4 className="text-xs font-semibold mb-1 text-muted-foreground">
                  参数
                </h4>
                <div className="max-h-32 overflow-auto">
                  <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap break-words">
                    {formatJSON(args)}
                  </pre>
                </div>
              </div>
            )}

            {/* 结果 */}
            {status === 'success' && result && (
              <div>
                <h4 className="text-xs font-semibold mb-1 text-muted-foreground">
                  结果
                </h4>
                <div className="max-h-48 overflow-auto">
                  <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap break-words">
                    {formatJSON(result)}
                  </pre>
                </div>
              </div>
            )}

            {/* 错误 */}
            {status === 'error' && error && (
              <div>
                <h4 className="text-xs font-semibold mb-1 text-red-500">
                  错误信息
                </h4>
                <div className="text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 p-2 rounded break-words">
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
