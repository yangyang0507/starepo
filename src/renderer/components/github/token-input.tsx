import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind";

interface TokenInputProps {
  onTokenSubmit: (token: string) => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: string;
  className?: string;
}

export default function TokenInput({
  onTokenSubmit,
  onBack,
  isLoading = false,
  error,
  className,
}: TokenInputProps) {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token.trim()) {
      onTokenSubmit(token.trim());
    }
  };

  const isValidTokenFormat = (token: string) => {
    // GitHub Personal Access Token formats:
    // Classic: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (40 chars after ghp_)
    // Fine-grained: github_pat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
    return /^(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})$/.test(token);
  };

  const tokenValid = isValidTokenFormat(token);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold">输入Personal Access Token</h2>
        <p className="text-muted-foreground">
          请输入您的GitHub Personal Access Token
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="token" className="text-sm font-medium">
            Personal Access Token
          </label>
          <div className="relative">
            <input
              id="token"
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className={cn(
                "bg-background w-full rounded-md border px-3 py-2 text-sm",
                "focus:ring-primary focus:border-transparent focus:ring-2 focus:outline-none",
                "placeholder:text-muted-foreground",
                error ? "border-destructive" : "border-border",
                tokenValid && "border-green-500",
              )}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              disabled={isLoading}
            >
              {showToken ? "🙈" : "👁️"}
            </button>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          {token && !tokenValid && (
            <p className="text-sm text-amber-600">
              Token格式不正确，请检查是否完整复制
            </p>
          )}
          {tokenValid && (
            <p className="text-sm text-green-600">✓ Token格式正确</p>
          )}
        </div>

        <div className="bg-muted/50 space-y-3 rounded-lg p-4">
          <h3 className="text-sm font-medium">
            如何获取Personal Access Token：
          </h3>
          <ol className="text-muted-foreground list-inside list-decimal space-y-1 text-sm">
            <li>
              访问 GitHub Settings → Developer settings → Personal access tokens
            </li>
            <li>点击 &quot;Generate new token&quot; → &quot;Generate new token (classic)&quot;</li>
            <li>设置过期时间和所需权限范围</li>
            <li>复制生成的token并粘贴到上方输入框</li>
          </ol>
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-950/20">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <strong>所需权限：</strong> repo, user, read:org
              (用于访问star的仓库和用户信息)
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Button
            type="submit"
            disabled={!tokenValid || isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                验证Token...
              </>
            ) : (
              "验证并连接"
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={isLoading}
            className="w-full"
          >
            返回选择认证方式
          </Button>
        </form>
      </div>
    </div>
  );
}

export type { TokenInputProps };
