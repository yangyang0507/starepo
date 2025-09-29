import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Key, 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  EyeOff,
  Shield,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { cn } from "@/utils/tailwind";
import { githubAPI } from "@/api";
import type { AuthState, TokenValidationResult } from "@shared/types";

interface TokenManagementProps {
  onBack: () => void;
  onSuccess?: () => void;
  existingAuth?: AuthState | null;
}

export default function TokenManagement({
  onBack,
  onSuccess,
  existingAuth,
}: TokenManagementProps) {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<TokenValidationResult | null>(null);

  // Token 格式验证
  const isValidTokenFormat = (token: string) => {
    return /^(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})$/.test(token);
  };

  // 实时验证 Token
  const validateTokenLive = async (tokenValue: string) => {
    if (!tokenValue || !isValidTokenFormat(tokenValue)) {
      setValidationResult(null);
      return;
    }

    setIsValidating(true);
    try {
      const result = await githubAPI.validateToken(tokenValue);
      setValidationResult(result);
    } catch (error) {
      console.error("Token 验证失败:", error);
      setValidationResult({
        valid: false,
        error: error instanceof Error ? error.message : "验证失败",
      });
    } finally {
      setIsValidating(false);
    }
  };

  // 处理 Token 输入变化
  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newToken = e.target.value;
    setToken(newToken);
    setError("");
    
    // 防抖验证
    const timeoutId = setTimeout(() => {
      validateTokenLive(newToken);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  // 提交新 Token
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || !validationResult?.valid) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await githubAPI.authenticateWithToken(token.trim());
      onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "认证过程中发生错误";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 渲染 Token 验证状态
  const renderValidationStatus = () => {
    if (isValidating) {
      return (
        <div className="flex items-center gap-2 text-sm text-blue-600">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>验证中...</span>
        </div>
      );
    }

    if (!token || !isValidTokenFormat(token)) {
      if (token && !isValidTokenFormat(token)) {
        return (
          <div className="flex items-center gap-2 text-sm text-amber-600">
            <AlertCircle className="h-4 w-4" />
            <span>Token 格式不正确</span>
          </div>
        );
      }
      return null;
    }

    if (validationResult?.valid) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span>Token 验证成功</span>
          </div>
          {validationResult.user && (
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 space-y-2">
              <div className="text-sm font-medium">
                用户: {(validationResult.user as any)?.name || (validationResult.user as any)?.login}
              </div>
              {validationResult.scopes && validationResult.scopes.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">权限范围:</div>
                  <div className="flex flex-wrap gap-1">
                    {validationResult.scopes.map((scope) => (
                      <Badge key={scope} variant="secondary" className="text-xs">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (validationResult?.error) {
      return (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" />
          <span>{validationResult.error}</span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">GitHub Token 管理</h1>
            <p className="text-muted-foreground">
              {existingAuth?.isAuthenticated ? "更换" : "添加"} Personal Access Token
            </p>
          </div>
        </div>

        {/* 当前状态 */}
        {existingAuth?.isAuthenticated && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                当前连接状态
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-medium">
                    {existingAuth.user?.name || existingAuth.user?.login}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    @{existingAuth.user?.login}
                  </div>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  已连接
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                更换 Token 将会断开当前连接并使用新的 Token 重新认证
              </p>
            </CardContent>
          </Card>
        )}

        {/* Token 输入表单 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Key className="h-5 w-5" />
              {existingAuth?.isAuthenticated ? "新的" : ""} Personal Access Token
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Token 输入框 */}
              <div className="space-y-2">
                <label htmlFor="token" className="text-sm font-medium">
                  Token
                </label>
                <div className="relative">
                  <input
                    id="token"
                    type={showToken ? "text" : "password"}
                    value={token}
                    onChange={handleTokenChange}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className={cn(
                      "bg-background w-full rounded-md border px-3 py-2 pr-10 text-sm",
                      "focus:ring-primary focus:border-transparent focus:ring-2 focus:outline-none",
                      "placeholder:text-muted-foreground",
                      error ? "border-destructive" : "border-border",
                      validationResult?.valid && "border-green-500"
                    )}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                    disabled={isLoading}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* 验证状态显示 */}
                {renderValidationStatus()}

                {/* 错误信息 */}
                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              {/* 提交按钮 */}
              <Button
                type="submit"
                disabled={!validationResult?.valid || isLoading || isValidating}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    {existingAuth?.isAuthenticated ? "更换中..." : "验证中..."}
                  </>
                ) : (
                  <>
                    <Key className="mr-2 h-4 w-4" />
                    {existingAuth?.isAuthenticated ? "更换 Token" : "添加 Token"}
                  </>
                )}
              </Button>
            </form>

            <Separator />

            {/* 帮助信息 */}
            <div className="space-y-4">
              <h3 className="font-medium">如何获取 Personal Access Token：</h3>
              <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
                <li>访问 GitHub Settings → Developer settings → Personal access tokens</li>
                <li>点击 &quot;Generate new token&quot; → &quot;Generate new token (classic)&quot;</li>
                <li>设置过期时间和必要的权限范围</li>
                <li>复制生成的 Token 并粘贴到上方输入框</li>
              </ol>

              <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                  所需权限范围：
                </h4>
                <div className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
                  <div><strong>user</strong> - 读取用户基本信息</div>
                  <div><strong>public_repo</strong> - 访问公共仓库（获取 Star 列表）</div>
                  <div><strong>repo</strong> - 访问私有仓库（可选，如果需要私有仓库的 Star）</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
