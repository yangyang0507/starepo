import React, { useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import GitHubAuthPage from "@/pages/github-auth-page";
import MainApp from "./main-app";

interface AuthGuardProps {
  children?: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { authState, isLoading, error, initAuth, refreshAuth } = useAuthStore();

  const handleAuthSuccess = useCallback(() => {
    // Auth state will be updated automatically by the store
    refreshAuth();
  }, [refreshAuth]);

  const handleAuthFailure = useCallback((errorMessage?: string) => {
    console.error("认证失败:", errorMessage);
    // Error state will be handled by the store
  }, []);

  const retryAuth = useCallback(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    // 初始认证状态检查
    initAuth();
  }, [initAuth]);

  // 加载状态
  if (isLoading) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground text-sm">正在检查认证状态...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error && !authState?.isAuthenticated) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <div className="max-w-md space-y-4 text-center">
          <div className="text-6xl">⚠️</div>
          <h2 className="text-destructive text-xl font-semibold">
            认证检查失败
          </h2>
          <p className="text-muted-foreground text-sm">{error?.message}</p>
          <button
            onClick={retryAuth}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 transition-colors"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  // 未认证状态 - 显示引导流程
  if (!authState?.isAuthenticated) {
    return (
      <GitHubAuthPage
        onAuthSuccess={handleAuthSuccess}
        onAuthFailure={handleAuthFailure}
      />
    );
  }

  // 已认证状态 - 显示主应用
  return <MainApp authState={authState}>{children}</MainApp>;
}
