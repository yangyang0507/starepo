import React, { useState, useEffect, useCallback } from "react";
import { githubAuthService } from "@/services/github/auth-service";
import { AuthGuardState, AuthState } from "@/services/github/types";
import GitHubAuthPage from "@/pages/github-auth-page";
import MainApp from "./main-app";

interface AuthGuardProps {
  children?: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const [state, setState] = useState<AuthGuardState>({
    authState: null,
    isLoading: true,
    error: null,
    hasCheckedAuth: false,
  });

  const updateAuthState = useCallback((authState: AuthState) => {
    setState((prev) => ({
      ...prev,
      authState,
      isLoading: false,
      error: null,
    }));
  }, []);

  const handleAuthError = useCallback((error: string) => {
    console.error("认证错误:", error);
    setState((prev) => ({
      ...prev,
      isLoading: false,
      error,
      hasCheckedAuth: true,
    }));
  }, []);

  const checkAuthState = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // 检查认证状态
      const authState = githubAuthService.getAuthState();

      if (authState.isAuthenticated) {
        // 如果已认证，验证token是否仍然有效
        const isValid = await githubAuthService.refreshAuth();
        if (isValid) {
          const updatedState = githubAuthService.getAuthState();
          updateAuthState(updatedState);
        } else {
          // Token无效，清除认证状态
          await githubAuthService.clearAuth();
          setState((prev) => ({
            ...prev,
            authState: { isAuthenticated: false },
            isLoading: false,
            hasCheckedAuth: true,
          }));
        }
      } else {
        // 未认证状态
        setState((prev) => ({
          ...prev,
          authState: { isAuthenticated: false },
          isLoading: false,
          hasCheckedAuth: true,
        }));
      }
    } catch (error) {
      console.error("认证状态检查失败:", error);
      handleAuthError(
        error instanceof Error ? error.message : "认证状态检查失败",
      );
    }
  }, [updateAuthState, handleAuthError]);

  const handleAuthSuccess = useCallback(() => {
    const authState = githubAuthService.getAuthState();
    updateAuthState(authState);
  }, [updateAuthState]);

  const handleAuthFailure = useCallback(
    (error?: string) => {
      handleAuthError(error || "认证失败");
    },
    [handleAuthError],
  );

  const retryAuth = useCallback(() => {
    checkAuthState();
  }, [checkAuthState]);

  useEffect(() => {
    // 初始认证状态检查
    checkAuthState();

    // 监听认证状态变化
    const unsubscribe = githubAuthService.addAuthListener((authState) => {
      updateAuthState(authState);
    });

    return () => {
      unsubscribe();
    };
  }, [checkAuthState, updateAuthState]);

  // 加载状态
  if (state.isLoading) {
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
  if (state.error && !state.authState?.isAuthenticated) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <div className="max-w-md space-y-4 text-center">
          <div className="text-6xl">⚠️</div>
          <h2 className="text-destructive text-xl font-semibold">
            认证检查失败
          </h2>
          <p className="text-muted-foreground text-sm">{state.error}</p>
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
  if (!state.authState?.isAuthenticated) {
    return (
      <GitHubAuthPage
        onAuthSuccess={handleAuthSuccess}
        onAuthFailure={handleAuthFailure}
      />
    );
  }

  // 已认证状态 - 显示主应用
  return <MainApp authState={state.authState}>{children}</MainApp>;
}
