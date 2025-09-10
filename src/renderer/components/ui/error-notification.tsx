import React, { useEffect } from "react";
import { X, AlertTriangle, AlertCircle, Info, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/utils/tailwind";
import type { AppError } from "@/hooks/use-error-handler";

interface ErrorNotificationProps {
  error: AppError;
  onDismiss: (errorId: string) => void;
  className?: string;
}

// 错误严重程度配置
const severityConfig = {
  low: {
    icon: Info,
    bgClass: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
    iconClass: "text-blue-500",
    textClass: "text-blue-900 dark:text-blue-100",
  },
  medium: {
    icon: AlertCircle,
    bgClass: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800",
    iconClass: "text-yellow-500",
    textClass: "text-yellow-900 dark:text-yellow-100",
  },
  high: {
    icon: AlertTriangle,
    bgClass: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
    iconClass: "text-red-500",
    textClass: "text-red-900 dark:text-red-100",
  },
  critical: {
    icon: Zap,
    bgClass: "bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-700",
    iconClass: "text-red-600",
    textClass: "text-red-950 dark:text-red-50",
  },
};

export function ErrorNotification({ error, onDismiss, className }: ErrorNotificationProps) {
  const config = severityConfig[error.severity];
  const Icon = config.icon;

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // 自动关闭（除了 critical 错误）
  useEffect(() => {
    if (error.severity !== "critical") {
      const timer = setTimeout(() => {
        onDismiss(error.id);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [error.id, error.severity, onDismiss]);

  return (
    <Card className={cn(
      "relative animate-in slide-in-from-right-full duration-300",
      config.bgClass,
      className
    )}>
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", config.iconClass)} />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className={cn("text-sm font-medium", config.textClass)}>
                {error.category.charAt(0).toUpperCase() + error.category.slice(1)} Error
              </p>
              <div className="flex items-center space-x-2">
                <span className={cn("text-xs", config.textClass, "opacity-70")}>
                  {formatTime(error.timestamp)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-6 w-6 p-0", config.textClass, "hover:bg-black/10")}
                  onClick={() => onDismiss(error.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <p className={cn("text-sm", config.textClass, "opacity-90")}>
              {error.message}
            </p>
            
            {error.code && (
              <p className={cn("text-xs mt-1", config.textClass, "opacity-60")}>
                Code: {error.code}
              </p>
            )}
            
            {error.details && error.severity === "critical" && (
              <details className="mt-2">
                <summary className={cn("text-xs cursor-pointer", config.textClass, "opacity-80")}>
                  Show details
                </summary>
                <pre className={cn("text-xs mt-1 p-2 rounded bg-black/10 overflow-auto", config.textClass)}>
                  {error.details}
                </pre>
              </details>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 错误通知容器
interface ErrorNotificationContainerProps {
  errors: AppError[];
  onDismiss: (errorId: string) => void;
  maxVisible?: number;
  className?: string;
}

export function ErrorNotificationContainer({
  errors,
  onDismiss,
  maxVisible = 5,
  className,
}: ErrorNotificationContainerProps) {
  // 按严重程度和时间排序
  const sortedErrors = [...errors]
    .sort((a, b) => {
      // 首先按严重程度排序
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      
      if (severityDiff !== 0) return severityDiff;
      
      // 然后按时间排序（最新的在前）
      return b.timestamp - a.timestamp;
    })
    .slice(0, maxVisible);

  if (sortedErrors.length === 0) return null;

  return (
    <div className={cn(
      "fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full",
      className
    )}>
      {sortedErrors.map((error) => (
        <ErrorNotification
          key={error.id}
          error={error}
          onDismiss={onDismiss}
        />
      ))}
      
      {errors.length > maxVisible && (
        <Card className="bg-muted/80 backdrop-blur-sm border-muted">
          <CardContent className="p-3 text-center">
            <p className="text-sm text-muted-foreground">
              +{errors.length - maxVisible} more errors
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// 错误摘要组件
interface ErrorSummaryProps {
  errorStats: {
    total: number;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    recent: number;
  };
  onClearAll?: () => void;
  className?: string;
}

export function ErrorSummary({ errorStats, onClearAll, className }: ErrorSummaryProps) {
  if (errorStats.total === 0) return null;

  return (
    <Card className={cn("bg-muted/50", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">Error Summary</h3>
          {onClearAll && (
            <Button variant="ghost" size="sm" onClick={onClearAll}>
              Clear All
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total: {errorStats.total}</p>
            <p className="text-muted-foreground">Recent: {errorStats.recent}</p>
          </div>
          
          <div>
            <p className="text-muted-foreground">By Severity:</p>
            {Object.entries(errorStats.bySeverity).map(([severity, count]) => (
              <p key={severity} className="text-xs">
                {severity}: {count}
              </p>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}