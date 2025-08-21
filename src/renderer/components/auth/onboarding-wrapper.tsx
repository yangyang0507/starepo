import React from "react";
import { AuthStep } from "@/services/github/types";

interface OnboardingWrapperProps {
  children: React.ReactNode;
  currentStep: AuthStep;
  completedSteps: AuthStep[];
  error?: string;
  isLoading?: boolean;
  onRetry?: () => void;
}

const stepLabels: Record<AuthStep, string> = {
  selector: "选择认证方式",
  token: "Token 认证",
  success: "认证成功",
};

const stepOrder: AuthStep[] = ["selector", "token", "success"];

export default function OnboardingWrapper({
  children,
  currentStep,
  completedSteps,
  error,
  isLoading,
  onRetry,
}: OnboardingWrapperProps) {
  const getCurrentStepIndex = () => {
    return stepOrder.indexOf(currentStep);
  };

  const renderProgressIndicator = () => {
    const currentIndex = getCurrentStepIndex();
    const totalSteps = stepOrder.length;
    const progressPercent =
      completedSteps.length > 0
        ? Math.max(
            10,
            ((completedSteps.length + (currentStep !== "selector" ? 0.5 : 0)) /
              totalSteps) *
              100,
          )
        : Math.max(10, ((currentIndex + 1) / totalSteps) * 100);

    return (
      <div className="mx-auto mb-8 w-full max-w-md">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-muted-foreground text-sm font-medium">
            步骤 {Math.max(1, currentIndex + 1)} / {totalSteps}
          </span>
          <span className="text-muted-foreground text-sm">
            {stepLabels[currentStep]}
          </span>
        </div>

        <div className="bg-secondary h-2 w-full rounded-full">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progressPercent}%`,
            }}
          />
        </div>
      </div>
    );
  };

  const renderErrorSection = () => {
    if (!error) return null;

    return (
      <div className="mx-auto mb-6 w-full max-w-md">
        <div className="bg-destructive/10 border-destructive/20 rounded-lg border p-4">
          <div className="flex items-start space-x-3">
            <div className="text-destructive text-lg">⚠️</div>
            <div className="flex-1">
              <h4 className="text-destructive mb-1 text-sm font-medium">
                认证错误
              </h4>
              <p className="text-destructive/80 text-sm">{error}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="text-destructive hover:text-destructive/80 mt-3 text-sm underline"
                  disabled={isLoading}
                >
                  {isLoading ? "重试中..." : "重试"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-background flex min-h-screen flex-col">
      {/* Header */}
      <div className="bg-card/50 border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">🌟</div>
            <div>
              <h1 className="text-xl font-semibold">StarRepo</h1>
              <p className="text-muted-foreground text-sm">
                连接您的 GitHub 账户以开始使用
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col justify-center px-6 py-8">
        <div className="mx-auto w-full max-w-lg">
          {renderProgressIndicator()}
          {renderErrorSection()}

          {/* Loading Overlay */}
          <div className={`relative ${isLoading ? "pointer-events-none" : ""}`}>
            {isLoading && (
              <div className="bg-background/50 absolute inset-0 z-10 flex items-center justify-center rounded-lg backdrop-blur-sm">
                <div className="flex flex-col items-center space-y-2">
                  <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2"></div>
                  <span className="text-muted-foreground text-sm">
                    处理中...
                  </span>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="bg-card rounded-lg border p-6 shadow-sm">
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-card/25 border-t px-6 py-4">
        <div className="text-muted-foreground text-center text-xs">
          StarRepo - GitHub 仓库管理工具
        </div>
      </div>
    </div>
  );
}
