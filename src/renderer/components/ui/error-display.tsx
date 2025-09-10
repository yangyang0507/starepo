import React from "react";
import { AlertTriangle, RefreshCw, Home, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/utils/tailwind";

interface ErrorDisplayProps {
  title?: string;
  message: string;
  details?: string;
  variant?: "default" | "destructive" | "warning";
  showRetry?: boolean;
  showHome?: boolean;
  onRetry?: () => void;
  onHome?: () => void;
  className?: string;
}

const variantConfig = {
  default: {
    icon: Info,
    iconClass: "text-blue-500",
    bgClass: "bg-blue-50 dark:bg-blue-950/20",
  },
  destructive: {
    icon: AlertTriangle,
    iconClass: "text-destructive",
    bgClass: "bg-destructive/10",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-yellow-500",
    bgClass: "bg-yellow-50 dark:bg-yellow-950/20",
  },
};

export function ErrorDisplay({
  title = "出现错误",
  message,
  details,
  variant = "destructive",
  showRetry = true,
  showHome = false,
  onRetry,
  onHome,
  className,
}: ErrorDisplayProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <Card className={cn("w-full max-w-2xl mx-auto", className)}>
      <CardHeader className="text-center">
        <div className={cn("mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full", config.bgClass)}>
          <Icon className={cn("h-6 w-6", config.iconClass)} />
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant={variant === "destructive" ? "destructive" : "default"}>
          <AlertDescription>{message}</AlertDescription>
        </Alert>

        {details && (
          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="mb-2 font-medium text-sm">详细信息:</h4>
            <p className="text-sm text-muted-foreground font-mono whitespace-pre-wrap">
              {details}
            </p>
          </div>
        )}

        {(showRetry || showHome) && (
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            {showRetry && onRetry && (
              <Button onClick={onRetry} variant="default" className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                重试
              </Button>
            )}
            {showHome && onHome && (
              <Button onClick={onHome} variant="outline" className="flex-1">
                <Home className="mr-2 h-4 w-4" />
                返回首页
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// 内联错误显示组件
export function InlineError({
  message,
  details,
  variant = "destructive",
  className,
}: {
  message: string;
  details?: string;
  variant?: "default" | "destructive" | "warning";
  className?: string;
}) {
  return (
    <Alert variant={variant === "destructive" ? "destructive" : "default"} className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        {message}
        {details && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm font-medium">
              查看详情
            </summary>
            <pre className="mt-1 text-xs whitespace-pre-wrap">
              {details}
            </pre>
          </details>
        )}
      </AlertDescription>
    </Alert>
  );
}

// 页面级错误显示
export function PageError({
  title = "页面加载失败",
  message,
  onRetry,
  onHome,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  onHome?: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[400px] p-4">
      <ErrorDisplay
        title={title}
        message={message}
        showRetry={!!onRetry}
        showHome={!!onHome}
        onRetry={onRetry}
        onHome={onHome}
      />
    </div>
  );
}