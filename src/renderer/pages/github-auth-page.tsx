import React, { useState, useEffect } from "react";
import GitHubAuthSelector from "@/components/github/github-auth-selector";
import TokenInput from "@/components/github/token-input";
import OnboardingWrapper from "@/components/auth/onboarding-wrapper";
import { Button } from "@/components/ui/button";
import { githubAuthService } from "@/services/github/auth-service";
import type { AuthState, AuthStep } from "@/services/github/types";

interface GitHubAuthPageProps {
  onAuthSuccess?: () => void;
  onAuthFailure?: (error?: string) => void;
}

export default function GitHubAuthPage({
  onAuthSuccess,
  onAuthFailure,
}: GitHubAuthPageProps) {
  const [currentStep, setCurrentStep] = useState<AuthStep>("selector");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const authService = githubAuthService;

  useEffect(() => {
    // 检查是否已经认证
    const checkAuthState = async () => {
      try {
        const state = authService.getAuthState();
        if (state.isAuthenticated) {
          setAuthState(state);
          setCurrentStep("success");
        }
      } catch (error) {
        console.error("检查认证状态失败:", error);
      }
    };

    checkAuthState();

    // 监听认证状态变化
    const unsubscribe = authService.addAuthListener((state) => {
      if (state.isAuthenticated) {
        setAuthState(state);
        setCurrentStep("success");
        // 认证成功后立即通知父组件
        onAuthSuccess?.();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [onAuthSuccess]);

  const handleAuthMethodSelect = () => {
    setError("");
    setCurrentStep("token");
  };

  const handleTokenSubmit = async (token: string) => {
    setIsLoading(true);
    setError("");

    try {
      const result = await authService.authenticateWithToken(token);

      if (result.success && result.user) {
        setAuthState({
          isAuthenticated: true,
          authMethod: "token",
          user: result.user,
          token,
        });
        setCurrentStep("success");
      } else {
        const errorMessage = result.error || "认证失败，请检查Token是否正确";
        setError(errorMessage);
        onAuthFailure?.(errorMessage);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "认证过程中发生错误";
      setError(errorMessage);
      onAuthFailure?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  
  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await authService.clearAuth();
      setAuthState(null);
      setCurrentStep("selector");
      setError("");
    } catch {
      setError("登出失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToSelector = () => {
    setCurrentStep("selector");
    setError("");
  };

  const handleRetry = () => {
    setError("");
    setIsLoading(false);
  };

  const getCompletedSteps = (): AuthStep[] => {
    const completed: AuthStep[] = [];
    if (currentStep !== "selector") completed.push("selector");
    if (currentStep === "success" && authState?.authMethod === "token") {
      completed.push("token");
    }
    return completed;
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "selector":
        return (
          <GitHubAuthSelector
            onAuthMethodSelect={() => handleAuthMethodSelect()}
            isLoading={isLoading}
          />
        );

      case "token":
        return (
          <TokenInput
            onTokenSubmit={handleTokenSubmit}
            onBack={handleBackToSelector}
            isLoading={isLoading}
            error={error}
          />
        );

      
      case "success":
        return (
          <div className="space-y-6 text-center">
            <div className="space-y-2">
              <div className="text-6xl">🎉</div>
              <h2 className="text-2xl font-bold">认证成功！</h2>
              <p className="text-muted-foreground">
                已成功连接到您的GitHub账户
              </p>
            </div>

            {authState?.user && (
              <div className="bg-muted/50 space-y-3 rounded-lg p-4 mx-auto max-w-sm">
                <div className="flex items-center justify-center space-x-3">
                  <img
                    src={authState.user.avatar_url}
                    alt={authState.user.login}
                    className="h-12 w-12 rounded-full"
                  />
                  <div className="text-left">
                    <h3 className="font-semibold">
                      {authState.user.name || authState.user.login}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      @{authState.user.login}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <div className="font-semibold">
                      {authState.user.public_repos}
                    </div>
                    <div className="text-muted-foreground">仓库</div>
                  </div>
                  <div>
                    <div className="font-semibold">
                      {authState.user.followers}
                    </div>
                    <div className="text-muted-foreground">关注者</div>
                  </div>
                  <div>
                    <div className="font-semibold">
                      {authState.user.following}
                    </div>
                    <div className="text-muted-foreground">关注中</div>
                  </div>
                </div>

                <div className="text-muted-foreground text-xs">
                  认证方式: Personal Access Token
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Button
                onClick={() => {
                  // 立即触发认证成功回调，让AuthGuard切换到主应用
                  onAuthSuccess?.();
                }}
                className="w-full max-w-sm mx-auto block"
                size="lg"
              >
                开始使用
              </Button>

              <Button
                variant="outline"
                onClick={handleLogout}
                disabled={isLoading}
                className="w-full max-w-sm mx-auto block"
              >
                {isLoading ? "登出中..." : "切换账户"}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <OnboardingWrapper
      currentStep={currentStep}
      completedSteps={getCompletedSteps()}
      error={error}
      isLoading={isLoading}
      onRetry={handleRetry}
    >
      {renderCurrentStep()}
    </OnboardingWrapper>
  );
}
