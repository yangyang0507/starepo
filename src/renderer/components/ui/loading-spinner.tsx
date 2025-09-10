import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils/tailwind";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  text?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6", 
  lg: "h-8 w-8",
};

export function LoadingSpinner({ 
  size = "md", 
  className,
  text 
}: LoadingSpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Loader2 className={cn("animate-spin", sizeClasses[size])} />
      {text && (
        <span className="text-sm text-muted-foreground">{text}</span>
      )}
    </div>
  );
}

// 全屏加载组件
export function FullScreenLoading({ text = "加载中..." }: { text?: string }) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-lg border p-6 shadow-lg">
        <LoadingSpinner size="lg" text={text} />
      </div>
    </div>
  );
}

// 页面加载组件
export function PageLoading({ text = "加载中..." }: { text?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center min-h-[400px]">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

// 按钮加载状态
export function ButtonLoading({ 
  size = "sm",
  className 
}: { 
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <Loader2 className={cn("animate-spin", sizeClasses[size], className)} />
  );
}