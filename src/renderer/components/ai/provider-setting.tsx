/**
 * Provider 设置组件
 * 右侧面板，显示选中 Provider 的详细配置
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAIAccountsStore } from "@/stores/ai-accounts-store";
import { ApiKeyInput } from "./api-key-input";
import { BaseUrlInput } from "./base-url-input";
import { ProtocolSelector } from "./protocol-selector";
import { ModelList } from "./model-list";
import { AddModelPopup } from "./add-model-popup";
import { getModelList, testProviderConnection } from "@/api/ai";
import { getProviderDefinition } from "@shared/data/ai-providers";
import {
  AI_PROTOCOL,
  type AIProviderId,
  type AIProtocol,
  type AIModel,
  type ModelSelectionState,
} from "@shared/types";

interface ProviderSettingProps {
  providerId: AIProviderId;
  providerName?: string;
}

export function ProviderSetting({
  providerId,
  providerName,
}: ProviderSettingProps) {
  const { accounts, getAccount, saveAccount } = useAIAccountsStore();
  const accountMetadata = accounts.get(providerId);
  const providerDefinition = getProviderDefinition(providerId);

  // 表单状态
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [protocol, setProtocol] = useState<AIProtocol>(
    AI_PROTOCOL.OPENAI_COMPATIBLE,
  );
  const [enabled, setEnabled] = useState(false);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);

  // UI 状态
  const [saveFeedback, setSaveFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [testError, setTestError] = useState("");

  // 模型列表状态
  const [models, setModels] = useState<AIModel[]>([]);
  const [modelState, setModelState] = useState<ModelSelectionState>("idle");
  const [modelError, setModelError] = useState("");

  // 添加模型弹窗状态
  const [isAddModelOpen, setIsAddModelOpen] = useState(false);

  const displayName = providerName || accountMetadata?.name || providerId;
  const defaultBaseUrl = providerDefinition?.defaults.baseUrl || "";

  // 自动保存定时器
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);

  // 自动保存函数（带 debounce）
  const autoSave = useCallback(async () => {
    if (isInitialLoadRef.current) return;

    try {
      await saveAccount({
        providerId,
        protocol,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        timeout: 30000,
        retries: 3,
        strictTLS: true,
        enabled,
      });

      setSaveFeedback({ type: "success", message: "已自动保存" });
      setTimeout(() => setSaveFeedback(null), 2000);
    } catch (error) {
      console.error("Auto-save failed:", error);
      setSaveFeedback({
        type: "error",
        message: "自动保存失败",
      });
    }
  }, [providerId, protocol, apiKey, baseUrl, enabled, saveAccount]);

  // 监听字段变化，触发自动保存
  useEffect(() => {
    if (isInitialLoadRef.current) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void autoSave();
    }, 1000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [apiKey, baseUrl, protocol, autoSave]);

  // 初始化表单数据 - 从后端加载完整配置
  useEffect(() => {
    const loadAccount = async () => {
      setIsLoadingAccount(true);
      setModels([]);
      setModelState("idle");
      setModelError("");

      try {
        const account = await getAccount(providerId);
        if (account) {
          setApiKey(account.apiKey || "");
          setBaseUrl(account.baseUrl || defaultBaseUrl);
          setProtocol(account.protocol || AI_PROTOCOL.OPENAI_COMPATIBLE);
          setEnabled(account.enabled ?? false);

          if (account.apiKey) {
            try {
              const config = {
                providerId,
                protocol: account.protocol || AI_PROTOCOL.OPENAI_COMPATIBLE,
                apiKey: account.apiKey,
                baseUrl: account.baseUrl || defaultBaseUrl || undefined,
                timeout: 30000,
                retries: 3,
                strictTLS: true,
                enabled: true,
              };

              const result = await getModelList(config, false);

              if (result.models.length > 0) {
                setModels(result.models);
                setModelState("cached");
              } else {
                setModelState("no-cache");
              }
            } catch (error) {
              console.debug("No cached models available:", error);
              setModelState("no-cache");
            }
          }
        } else {
          setApiKey("");
          setBaseUrl(defaultBaseUrl);
          setProtocol(AI_PROTOCOL.OPENAI_COMPATIBLE);
          setEnabled(false);
        }
      } catch (error) {
        console.error("Failed to load account:", error);
      } finally {
        setIsLoadingAccount(false);
        isInitialLoadRef.current = false;
      }
    };

    void loadAccount();
  }, [providerId, getAccount, defaultBaseUrl]);

  // 加载模型列表
  const loadModels = async (forceRefresh = false) => {
    if (!apiKey) {
      setModelError("请先配置 API Key");
      setModelState("error");
      return;
    }

    try {
      setModelState("loading");
      setModelError("");

      const config = {
        providerId,
        protocol,
        apiKey,
        baseUrl: baseUrl || undefined,
        timeout: 30000,
        retries: 3,
        strictTLS: true,
        enabled: true,
      };

      const result = await getModelList(config, forceRefresh);
      setModels(result.models);
      setModelState(forceRefresh ? "success" : "cached");
    } catch (error) {
      console.error("Failed to load models:", error);

      let errorMessage = "加载失败";
      if (error instanceof Error) {
        if (error.message.includes("401") || error.message.includes("403")) {
          errorMessage = "API Key 无效或权限不足";
        } else if (
          error.message.includes("timeout") ||
          error.message.includes("ETIMEDOUT")
        ) {
          errorMessage = "连接超时，请检查网络或 Base URL";
        } else if (
          error.message.includes("ENOTFOUND") ||
          error.message.includes("ECONNREFUSED")
        ) {
          errorMessage = "无法连接到服务器，请检查 Base URL";
        } else {
          errorMessage = error.message;
        }
      }

      setModelError(errorMessage);
      setModelState("error");
    }
  };

  // 测试连接
  const handleTestConnection = async () => {
    if (!apiKey) {
      setTestError("请先输入 API Key");
      setTestStatus("error");
      return;
    }

    try {
      setIsTesting(true);
      setTestStatus("idle");
      setTestError("");

      const config = {
        providerId,
        protocol,
        apiKey,
        baseUrl: baseUrl || undefined,
        timeout: 30000,
        retries: 3,
        strictTLS: true,
        enabled: true,
      };

      const result = await testProviderConnection(config);

      if (result.success) {
        setTestStatus("success");
        await loadModels(true);
      } else {
        setTestStatus("error");

        let errorMessage = "连接失败";
        if (result.error) {
          const error =
            typeof result.error === "string"
              ? result.error
              : result.error.message;

          if (
            error.includes("401") ||
            error.includes("403") ||
            error.includes("Invalid")
          ) {
            errorMessage = "API Key 无效，请检查后重试";
          } else if (error.includes("timeout") || error.includes("ETIMEDOUT")) {
            errorMessage = "连接超时，请检查网络连接";
          } else if (
            error.includes("ENOTFOUND") ||
            error.includes("ECONNREFUSED")
          ) {
            errorMessage = "无法连接到服务器，请检查 Base URL 是否正确";
          } else if (error.includes("SSL") || error.includes("certificate")) {
            errorMessage = "SSL 证书验证失败，请检查服务器配置";
          } else {
            errorMessage = error;
          }
        }

        setTestError(errorMessage);
      }
    } catch (error) {
      console.error("Connection test failed:", error);
      setTestStatus("error");

      let errorMessage = "连接失败";
      if (error instanceof Error) {
        if (error.message.includes("Network")) {
          errorMessage = "网络错误，请检查网络连接";
        } else {
          errorMessage = error.message;
        }
      }

      setTestError(errorMessage);
    } finally {
      setIsTesting(false);
    }
  };

  // 切换启用状态（立即保存）
  const handleToggleEnabled = async (newEnabled: boolean) => {
    setEnabled(newEnabled);

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    try {
      await saveAccount({
        providerId,
        protocol,
        apiKey: apiKey || undefined,
        baseUrl: baseUrl || undefined,
        timeout: 30000,
        retries: 3,
        strictTLS: true,
        enabled: newEnabled,
      });

      setSaveFeedback({ type: "success", message: "已保存" });
      setTimeout(() => setSaveFeedback(null), 2000);
    } catch (error) {
      console.error("Failed to toggle provider:", error);
      setSaveFeedback({
        type: "error",
        message: "保存失败",
      });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {/* 标题和启用开关 */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">{displayName}</h2>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <Label
              htmlFor="provider-enabled"
              className="cursor-pointer text-sm"
            >
              启用
            </Label>
            <Switch
              id="provider-enabled"
              checked={enabled}
              onCheckedChange={handleToggleEnabled}
              disabled={isLoadingAccount}
            />
          </div>
        </div>

        <Separator />

        {/* 加载状态 */}
        {isLoadingAccount ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            <span className="text-muted-foreground ml-2 text-sm">
              加载配置中...
            </span>
          </div>
        ) : (
          /* 配置表单 */
          <div className="space-y-6">
            {/* API Key */}
            <ApiKeyInput
              value={apiKey}
              onChange={setApiKey}
              onTest={handleTestConnection}
              isTestLoading={isTesting}
              testStatus={testStatus}
            />

            {/* 测试错误提示 */}
            {testStatus === "error" && testError && (
              <div className="text-destructive -mt-2 flex items-start gap-2 text-sm">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{testError}</span>
              </div>
            )}

            {/* Base URL */}
            <BaseUrlInput
              value={baseUrl}
              onChange={setBaseUrl}
              placeholder="API 服务地址"
            />

            {/* 协议选择 */}
            <ProtocolSelector value={protocol} onChange={setProtocol} />

            {/* 模型列表（始终显示） */}
            <ModelList
              models={models}
              state={modelState}
              onRefresh={() => loadModels(true)}
              onAddCustomModel={() => setIsAddModelOpen(true)}
              error={modelError}
            />

            {/* 添加模型弹窗 */}
            <AddModelPopup
              open={isAddModelOpen}
              onOpenChange={setIsAddModelOpen}
              onConfirm={async (model) => {
                // 设置 providerId
                const newModel = { ...model, providerId };
                // 添加到模型列表
                setModels([...models, newModel]);
                setModelState("idle");
              }}
            />

            {/* 保存反馈提示 */}
            {saveFeedback && (
              <div className="pt-4">
                <div
                  className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                    saveFeedback.type === "success"
                      ? "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {saveFeedback.type === "success" ? (
                    <CheckCircle2 size={16} className="flex-shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="flex-shrink-0" />
                  )}
                  <span>{saveFeedback.message}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
