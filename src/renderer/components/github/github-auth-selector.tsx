import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";
import type { AuthMethodOption } from "@/api";

interface GitHubAuthSelectorProps {
  onAuthMethodSelect: (method: "token") => void;
  isLoading?: boolean;
  className?: string;
}

const authMethods: AuthMethodOption[] = [
  {
    id: "token",
    title: "Personal Access Token",
    description: "使用GitHub个人访问令牌进行认证",
    icon: "🔑",
    recommended: true,
  },
];

export default function GitHubAuthSelector({
  onAuthMethodSelect,
  isLoading = false,
  className,
}: GitHubAuthSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<"token" | null>(null);

  const handleMethodSelect = (method: "token") => {
    setSelectedMethod(method);
    onAuthMethodSelect(method);
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold">连接GitHub</h2>
        <p className="text-muted-foreground">
          使用Personal Access Token来访问您的GitHub账户
        </p>
      </div>

      <div className="space-y-3">
        {authMethods.map((method) => (
          <div
            key={method.id}
            className={cn(
              "hover:border-primary/50 relative cursor-pointer rounded-lg border p-4 transition-all",
              selectedMethod === method.id
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-accent/50",
              isLoading && "pointer-events-none opacity-50",
            )}
            onClick={() => handleMethodSelect(method.id)}
          >
            {method.recommended && (
              <div className="absolute -top-2 right-3">
                <span className="bg-primary text-primary-foreground rounded-full px-2 py-1 text-xs">
                  推荐
                </span>
              </div>
            )}

            <div className="flex items-start space-x-3">
              <div className="text-2xl">{method.icon}</div>
              <div className="flex-1 space-y-1">
                <h3 className="font-semibold">{method.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {method.description}
                </p>
              </div>
              <div className="flex items-center">
                <div
                  className={cn(
                    "h-4 w-4 rounded-full border-2 transition-colors",
                    selectedMethod === method.id
                      ? "border-primary bg-primary"
                      : "border-muted-foreground",
                  )}
                >
                  {selectedMethod === method.id && (
                    <div className="h-full w-full scale-50 rounded-full bg-white" />
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedMethod && (
        <div className="space-y-3">
          <Button
            onClick={() => handleMethodSelect(selectedMethod)}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                继续认证...
              </>
            ) : (
              `使用 ${authMethods.find((m) => m.id === selectedMethod)?.title} 继续`
            )}
          </Button>

          <div className="text-muted-foreground space-y-1 text-center text-xs">
            <>
              <p>• 需要在GitHub设置中创建Personal Access Token</p>
              <p>• 需要授予适当的权限范围</p>
              <p>• Token将被安全加密存储</p>
            </>
          </div>
        </div>
      )}
    </div>
  );
}

export type { GitHubAuthSelectorProps };
