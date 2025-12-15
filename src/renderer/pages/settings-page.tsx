import TokenManagement from "@/components/github/token-management";
import { AppLayout } from "@/components/layout/app-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/hooks/use-theme";
import { useExternalLink } from "@/hooks/use-external-link";
import { useAuthStore } from "@/stores/auth-store";
import { useRepositoryStore } from "@/stores/repository-store";
import { setAppLanguage } from "@/utils/language-helpers";
import { cn } from "@/utils/tailwind";
import type { ThemeMode, LogLevel } from "@shared/types";
import {
  AlertCircle,
  CheckCircle,
  Edit2,
  ExternalLink,
  Github,
  Globe,
  Eye,
  EyeOff,
  Key,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  Shield,
  Sun,
  User
} from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { settingsAPI, logLevelLabels } from "@/api/settings";
import { configureAutoSync, triggerAutoSyncNow } from "@/hooks/use-auto-sync";
import { useAIApi } from "@/api/ai";
import { AISafeSettings, AIProvider, PREDEFINED_MODELS } from "@shared/types";
import { useLocation } from "@tanstack/react-router";

const AI_SETTINGS_HASH = "ai-settings";

const PROVIDER_OPTIONS: { value: AIProvider; label: string; description: string }[] = [
  { value: "openai", label: "OpenAI", description: "官方 GPT 系列模型，功能全面" },
  { value: "anthropic", label: "Anthropic", description: "Claude 系列模型，擅长长文本理解" },
  { value: "deepseek", label: "DeepSeek", description: "中国大陆可用的高性价比模型" },
  { value: "ollama", label: "Ollama", description: "本地部署模型，需要手动配置" },
];

const getDefaultModelForProvider = (provider: AIProvider) => {
  const options = PREDEFINED_MODELS[provider] ?? [];
  return options[0]?.modelId ?? "gpt-4o";
};

const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return null;
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString();
  }
};

function AISettingsSection() {
  const {
    getAISettings: fetchAISettings,
    updateAISettings: persistAISettings,
    testConnection,
  } = useAIApi();

  const [safeSettings, setSafeSettings] = useState<AISafeSettings | null>(null);
  const [provider, setProvider] = useState<AIProvider>("openai");
  const [model, setModel] = useState<string>(getDefaultModelForProvider("openai"));
  const [maxTokens, setMaxTokens] = useState<string>("1024");
  const [temperature, setTemperature] = useState<string>("0.7");
  const [topP, setTopP] = useState<string>("1");
  const [apiKey, setApiKey] = useState<string>("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [highlight, setHighlight] = useState(false);

  const sectionRef = useRef<HTMLDivElement | null>(null);
  const { hash } = useLocation();

  const hydrateSettings = useCallback((settings: AISafeSettings | null) => {
    setSafeSettings(settings);
    const nextProvider = settings?.provider ?? "openai";
    setProvider(nextProvider);
    setModel(settings?.model || getDefaultModelForProvider(nextProvider));
    setMaxTokens(String(settings?.maxTokens ?? 1024));
    setTemperature(String(settings?.temperature ?? 0.7));
    setTopP(String(settings?.topP ?? 1));
    setHasStoredKey(Boolean(settings?.configured));
    setApiKey("");
    setApiKeyVisible(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoadingSettings(true);
      try {
        const settings = await fetchAISettings();
        if (cancelled) return;
        hydrateSettings(settings);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "加载 AI 设置失败";
          setSaveFeedback({ type: "error", message });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSettings(false);
        }
      }
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [fetchAISettings, hydrateSettings]);

  useEffect(() => {
    if (!sectionRef.current) return;
    if (hash === `#${AI_SETTINGS_HASH}`) {
      sectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlight(true);
      const timer = setTimeout(() => setHighlight(false), 1800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [hash]);

  const availableModels = useMemo(() => {
    const defaults = PREDEFINED_MODELS[provider] ?? [];
    if (model && !defaults.some((item) => item.modelId === model)) {
      return [
        ...defaults,
        {
          provider,
          modelId: model,
          label: `${model}（自定义）`,
          description: "当前使用的自定义模型",
        },
      ];
    }
    return defaults;
  }, [provider, model]);

  const selectedModelInfo = useMemo(
    () => availableModels.find((item) => item.modelId === model),
    [availableModels, model]
  );

  const isConfigured = safeSettings?.configured ?? false;
  const lastUpdatedLabel = formatTimestamp(safeSettings?.lastUpdated);

  const handleProviderChange = (nextProvider: AIProvider) => {
    setProvider(nextProvider);
    setModel(getDefaultModelForProvider(nextProvider));
    setApiKey("");
    setApiKeyVisible(false);
    setHasStoredKey(false);
    setTestFeedback(null);
    setSaveFeedback(null);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestFeedback(null);
    try {
      const effectiveApiKey = apiKey.trim();
      if (!effectiveApiKey) {
        throw new Error("请先输入 API Key 后再进行连接测试");
      }

      const effectiveModel = model || availableModels[0]?.modelId;
      if (!effectiveModel) {
        throw new Error("请先选择要测试的模型");
      }

      await testConnection({
        provider,
        apiKey: effectiveApiKey,
        model: effectiveModel,
      });

      setTestFeedback({ type: "success", message: "连接成功，配置可用" });
    } catch (error) {
      setTestFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "连接测试失败",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveFeedback(null);
    try {
      const trimmedKey = apiKey.trim();
      if (!hasStoredKey && !trimmedKey) {
        throw new Error("首次配置需要输入有效的 API Key");
      }

      if (!model) {
        throw new Error("请选择 LLM 模型");
      }

      const maxTokensValue = Number(maxTokens);
      if (Number.isNaN(maxTokensValue) || maxTokensValue <= 0) {
        throw new Error("Max Tokens 必须是正整数");
      }

      const temperatureValue = Number(temperature);
      if (Number.isNaN(temperatureValue) || temperatureValue < 0 || temperatureValue > 2) {
        throw new Error("Temperature 必须在 0-2 之间");
      }

      const topPValue = Number(topP);
      if (Number.isNaN(topPValue) || topPValue < 0 || topPValue > 1) {
        throw new Error("Top P 必须在 0-1 之间");
      }

      const payload = {
        provider,
        model,
        maxTokens: maxTokensValue,
        temperature: temperatureValue,
        topP: topPValue,
        ...(trimmedKey ? { apiKey: trimmedKey } : {}),
      };

      await persistAISettings(payload);
      const refreshed = await fetchAISettings();
      hydrateSettings(refreshed);
      setSaveFeedback({ type: "success", message: "AI 设置已保存" });
      setHasStoredKey(Boolean(trimmedKey) || Boolean(refreshed?.configured));
    } catch (error) {
      setSaveFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "保存设置失败",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card
      id={AI_SETTINGS_HASH}
      ref={sectionRef}
      className={cn(
        "transition-shadow duration-300",
        highlight ? "ring-2 ring-primary/60 shadow-lg" : undefined
      )}
    >
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            🤖 AI 助手设置
            <Badge variant={isConfigured ? "default" : "secondary"}>
              {isConfigured ? "已配置" : "未配置"}
            </Badge>
          </span>
          {lastUpdatedLabel ? (
            <span className="text-xs text-muted-foreground">最后更新：{lastUpdatedLabel}</span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>在此集中管理所有 AI 相关配置。首页的“设置”入口会跳转到这里。</p>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-100">
            💡 提示：保存后配置会立即生效，API Key 始终在本地安全存储。
          </div>
        </div>

        {isLoadingSettings ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载 AI 设置...
          </div>
        ) : (
          <>
            <section className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">LLM API 配置</h3>
                <p className="text-sm text-muted-foreground">
                  选择对话模型提供商并配置 API Key、模型与采样参数。
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-provider" className="text-base font-semibold">
                    AI 提供商
                  </Label>
                  <select
                    id="ai-provider"
                    value={provider}
                    onChange={(event) => handleProviderChange(event.target.value as AIProvider)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {PROVIDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {PROVIDER_OPTIONS.find((option) => option.value === provider)?.description}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-api-key" className="text-base font-semibold">
                    API Key
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="ai-api-key"
                      type={apiKeyVisible ? "text" : "password"}
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder={
                        hasStoredKey
                          ? "已保存的 API Key 已隐藏，输入新值可替换"
                          : "输入您的 API Key"
                      }
                      className="font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setApiKeyVisible((visible) => !visible)}
                    >
                      {apiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    我们不会上传或记录您的 API Key，数据仅保存在本地加密存储。
                  </p>
                  {hasStoredKey ? (
                    <p className="text-xs text-muted-foreground">
                      当前已保存一份密钥。如需清除请留空并保存，或输入新值进行替换。
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai-model" className="text-base font-semibold">
                    LLM 模型
                  </Label>
                  <select
                    id="ai-model"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {availableModels.map((option) => (
                      <option key={option.modelId} value={option.modelId}>
                        {option.label}
                        {option.recommended ? " ⭐" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {selectedModelInfo?.description ?? "选择适合业务场景的模型"}
                  </p>
                </div>

                <div className="lg:col-span-2">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="max-tokens" className="text-base font-semibold">
                        Max Tokens
                      </Label>
                      <Input
                        id="max-tokens"
                        type="number"
                        min={1}
                        max={100000}
                        value={maxTokens}
                        onChange={(event) => setMaxTokens(event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        限制模型单次回复的最大 token 数，默认 1024。
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="temperature" className="text-base font-semibold">
                        Temperature
                      </Label>
                      <Input
                        id="temperature"
                        type="number"
                        step={0.1}
                        min={0}
                        max={2}
                        value={temperature}
                        onChange={(event) => setTemperature(event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        控制回答的随机性，0 更稳健，1 更具创造力。
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="top-p" className="text-base font-semibold">
                        Top P
                      </Label>
                      <Input
                        id="top-p"
                        type="number"
                        step={0.05}
                        min={0}
                        max={1}
                        value={topP}
                        onChange={(event) => setTopP(event.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        采样概率阈值，建议保持默认 1，降低可提升稳定性。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting || isSaving}
                  className="gap-2"
                >
                  {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  测试连接
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-2"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  保存设置
                </Button>
              </div>

              {testFeedback ? (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                    testFeedback.type === "success"
                      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                      : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                  )}
                >
                  {testFeedback.type === "success" ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <span>{testFeedback.message}</span>
                </div>
              ) : null}
            </div>

            {saveFeedback ? (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                  saveFeedback.type === "success"
                    ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400"
                    : "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                )}
              >
                {saveFeedback.type === "success" ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span>{saveFeedback.message}</span>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showTokenManagement, setShowTokenManagement] = useState(false);
  const [developerMode, setDeveloperMode] = useState(false);
  const [logLevel, setLogLevelState] = useState<LogLevel>("info");
  const [advancedLoading, setAdvancedLoading] = useState(true);
  const [devModeUpdating, setDevModeUpdating] = useState(false);
  const [logLevelUpdating, setLogLevelUpdating] = useState(false);
  const [advancedError, setAdvancedError] = useState<string | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncInterval, setAutoSyncInterval] = useState(15);
  const [autoSyncUpdating, setAutoSyncUpdating] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);
  const [appSettingsError, setAppSettingsError] = useState<string | null>(null);
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSyncOptions = [5, 15, 30, 60];

  // Hooks
  const { authState, refreshAuth, logout } = useAuthStore();
  const { theme, changeTheme, isLoading: themeLoading } = useTheme();
  const { i18n } = useTranslation();

  const clearAppMessage = () => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
      messageTimeoutRef.current = null;
    }
    setCacheMessage(null);
  };

  const showAppMessage = (message: string) => {
    clearAppMessage();
    setCacheMessage(message);
    messageTimeoutRef.current = setTimeout(() => {
      setCacheMessage(null);
      messageTimeoutRef.current = null;
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        const currentSettings = await settingsAPI.getSettings();
        if (!mounted) return;
        setDeveloperMode(currentSettings.developerMode);
        setLogLevelState(currentSettings.logLevel);
        setAutoSyncEnabled(currentSettings.autoSyncEnabled);
        setAutoSyncInterval(currentSettings.autoSyncIntervalMinutes);
        setAdvancedError(null);
        setAppSettingsError(null);
        clearAppMessage();
      } catch (error) {
        if (!mounted) return;
        const message =
          error instanceof Error ? error.message : "加载高级设置失败";
        setAdvancedError(message);
        setAppSettingsError(message);
      } finally {
        if (mounted) {
          setAdvancedLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  const handleRefreshAuth = async () => {
    setIsLoading(true);
    try {
      await refreshAuth();
    } catch (error) {
      console.error("刷新认证失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logout();
    } catch (error) {
      console.error("登出失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 主题切换处理
  const handleThemeChange = async (newTheme: ThemeMode) => {
    try {
      await changeTheme(newTheme);
    } catch (error) {
      console.error("主题切换失败:", error);
    }
  };

  // 语言切换处理
  const handleLanguageChange = async (newLanguage: string) => {
    try {
      await setAppLanguage(newLanguage, i18n);
    } catch (error) {
      console.error("语言切换失败:", error);
    }
  };

  const handleToggleAutoSync = async () => {
    if (advancedLoading || autoSyncUpdating) {
      return;
    }

    const nextEnabled = !autoSyncEnabled;
    setAutoSyncUpdating(true);
    setAppSettingsError(null);
    try {
      const updated = await settingsAPI.updateSettings({
        autoSyncEnabled: nextEnabled,
        autoSyncIntervalMinutes: autoSyncInterval,
      });
      setAutoSyncEnabled(updated.autoSyncEnabled);
      setAutoSyncInterval(updated.autoSyncIntervalMinutes);
      await configureAutoSync(
        {
          enabled: updated.autoSyncEnabled,
          intervalMinutes: updated.autoSyncIntervalMinutes,
        },
        { immediate: updated.autoSyncEnabled },
      );
      showAppMessage(
        updated.autoSyncEnabled
          ? `自动同步已开启，每 ${updated.autoSyncIntervalMinutes} 分钟刷新`
          : "自动同步已关闭",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "更新自动同步设置失败";
      setAppSettingsError(message);
    } finally {
      setAutoSyncUpdating(false);
    }
  };

  const handleAutoSyncIntervalChange = async (value: string) => {
    if (advancedLoading || autoSyncUpdating) {
      return;
    }

    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes === autoSyncInterval) {
      return;
    }

    setAutoSyncUpdating(true);
    setAppSettingsError(null);
    try {
      const updated = await settingsAPI.updateSettings({
        autoSyncIntervalMinutes: minutes,
      });
      setAutoSyncEnabled(updated.autoSyncEnabled);
      setAutoSyncInterval(updated.autoSyncIntervalMinutes);
      await configureAutoSync(
        {
          enabled: updated.autoSyncEnabled,
          intervalMinutes: updated.autoSyncIntervalMinutes,
        },
        { immediate: updated.autoSyncEnabled },
      );
      showAppMessage(
        updated.autoSyncEnabled
          ? `自动同步间隔已调整为 ${updated.autoSyncIntervalMinutes} 分钟`
          : `已更新自动同步间隔为 ${updated.autoSyncIntervalMinutes} 分钟`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "更新自动同步间隔失败";
      setAppSettingsError(message);
    } finally {
      setAutoSyncUpdating(false);
    }
  };

  const handleClearCache = async () => {
    if (cacheClearing) {
      return;
    }
    setCacheClearing(true);
    setAppSettingsError(null);
    clearAppMessage();

    try {
      await settingsAPI.clearCache();
      const { refreshData, user } = useRepositoryStore.getState();
      if (user) {
        await refreshData();
      } else if (autoSyncEnabled) {
        await triggerAutoSyncNow();
      }
      showAppMessage("缓存已清理，数据将重新同步");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "清理缓存失败";
      setAppSettingsError(message);
    } finally {
      setCacheClearing(false);
    }
  };

  const handleToggleDeveloperMode = async () => {
    if (advancedLoading || devModeUpdating) {
      return;
    }

    const nextValue = !developerMode;
    setDevModeUpdating(true);
    setAdvancedError(null);

    try {
      const updated = await settingsAPI.updateSettings({
        developerMode: nextValue,
      });
      setDeveloperMode(updated.developerMode);
      setLogLevelState(updated.logLevel);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "更新开发者模式失败";
      setAdvancedError(message);
    } finally {
      setDevModeUpdating(false);
    }
  };

  const handleLogLevelChange = async (value: LogLevel) => {
    if (advancedLoading || logLevelUpdating || value === logLevel) {
      return;
    }

    setLogLevelUpdating(true);
    setAdvancedError(null);

    try {
      const updated = await settingsAPI.updateSettings({ logLevel: value });
      setLogLevelState(updated.logLevel);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "更新日志级别失败";
      setAdvancedError(message);
    } finally {
      setLogLevelUpdating(false);
    }
  };

  // 获取主题图标和标签
  const getThemeInfo = (themeMode: ThemeMode) => {
    switch (themeMode) {
      case "light":
        return { icon: Sun, label: "浅色模式" };
      case "dark":
        return { icon: Moon, label: "深色模式" };
      case "system":
        return { icon: Monitor, label: "跟随系统" };
      default:
        return { icon: Monitor, label: "跟随系统" };
    }
  };

  // 获取语言标签
  const getLanguageLabel = (language: string) => {
    switch (language) {
      case "zh-CN":
        return "🇨🇳 中文简体";
      case "en":
        return "🇺🇸 English";
      default:
        return "🇺🇸 English";
    }
  };

  // 使用统一的外部链接处理 hook
  const { openExternal: handleExternalLink } = useExternalLink();

  const renderGitHubSection = () => {
    if (!authState?.isAuthenticated) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              GitHub 连接
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>未连接到 GitHub</span>
            </div>
            <Button
              onClick={() => setShowTokenManagement(true)}
              className="w-full"
            >
              <Key className="mr-2 h-4 w-4" />
              添加 GitHub Token
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            GitHub 连接
            <Badge variant="outline" className="ml-auto text-green-600 border-green-600">
              <CheckCircle className="mr-1 h-3 w-3" />
              已连接
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 用户信息 */}
          <div className="flex items-start gap-4">
            <button
              onClick={() => handleExternalLink(`https://github.com/${authState.user?.login}`)}
              className="group"
            >
              <Avatar className="h-16 w-16 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                <AvatarImage
                  src={authState.user?.avatar_url}
                  alt={authState.user?.login || "用户头像"}
                />
                <AvatarFallback>
                  <User className="h-8 w-8" />
                </AvatarFallback>
              </Avatar>
            </button>
            <div className="flex-1 space-y-2">
              <div>
                <button
                  onClick={() => handleExternalLink(`https://github.com/${authState.user?.login}`)}
                  className="group text-left"
                >
                  <h3 className="font-semibold text-lg group-hover:text-primary transition-colors flex items-center gap-2">
                    {authState.user?.name || authState.user?.login || "未知用户"}
                    <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                </button>
                <button
                  onClick={() => handleExternalLink(`https://github.com/${authState.user?.login}`)}
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  @{authState.user?.login}
                </button>
              </div>
              {authState.user?.bio && (
                <p className="text-sm text-muted-foreground">
                  {authState.user.bio}
                </p>
              )}
              <div className="flex gap-4 text-sm">
                <button
                  onClick={() => handleExternalLink(`https://github.com/${authState.user?.login}?tab=repositories`)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
                >
                  <span className="font-medium">{authState.user?.public_repos || 0}</span>
                  <span>仓库</span>
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button
                  onClick={() => handleExternalLink(`https://github.com/${authState.user?.login}?tab=followers`)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
                >
                  <span className="font-medium">{authState.user?.followers || 0}</span>
                  <span>关注者</span>
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button
                  onClick={() => handleExternalLink(`https://github.com/${authState.user?.login}?tab=following`)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
                >
                  <span className="font-medium">{authState.user?.following || 0}</span>
                  <span>关注中</span>
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Token 信息 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">认证方式</h4>
              <Badge variant="secondary">
                <Key className="mr-1 h-3 w-3" />
                Personal Access Token
              </Badge>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Token 已验证且有效</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Token 已安全存储在本地加密存储中
              </p>
            </div>
          </div>

          <Separator />

          {/* 操作按钮 */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={handleRefreshAuth}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                刷新状态
              </Button>

              <Button
                variant="outline"
                onClick={() => setShowTokenManagement(true)}
                className="flex-1"
              >
                <Edit2 className="mr-2 h-4 w-4" />
                更换 Token
              </Button>
            </div>

            <Button
              variant="destructive"
              onClick={handleLogout}
              disabled={isLoading}
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {isLoading ? "登出中..." : "断开连接"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (showTokenManagement) {
    return (
      <TokenManagement
        onBack={() => setShowTokenManagement(false)}
        onSuccess={() => setShowTokenManagement(false)}
        existingAuth={authState}
      />
    );
  }

  return (
    <AppLayout title="设置">
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="text-base font-medium">设置</h1>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* GitHub 连接设置 */}
        {renderGitHubSection()}

        {/* 外观设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              外观设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 主题设置 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">主题模式</h4>
                  <p className="text-sm text-muted-foreground">
                    选择应用的外观主题
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const ThemeIcon = getThemeInfo(theme).icon;
                    return ThemeIcon ? <ThemeIcon className="h-4 w-4" /> : null;
                  })()}
                  <Badge variant="secondary">
                    {getThemeInfo(theme).label}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleThemeChange("light")}
                  disabled={themeLoading}
                  className="flex items-center gap-2"
                >
                  <Sun className="h-4 w-4" />
                  浅色
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleThemeChange("dark")}
                  disabled={themeLoading}
                  className="flex items-center gap-2"
                >
                  <Moon className="h-4 w-4" />
                  深色
                </Button>
                <Button
                  variant={theme === "system" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleThemeChange("system")}
                  disabled={themeLoading}
                  className="flex items-center gap-2"
                >
                  <Monitor className="h-4 w-4" />
                  系统
                </Button>
              </div>
            </div>

            <Separator />

            {/* 语言设置 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">显示语言</h4>
                  <p className="text-sm text-muted-foreground">
                    选择应用界面显示语言
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <Badge variant="secondary">
                    {getLanguageLabel(i18n.language)}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={i18n.language === "zh-CN" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleLanguageChange("zh-CN")}
                  className="flex items-center gap-2"
                >
                  🇨🇳 中文简体
                </Button>
                <Button
                  variant={i18n.language === "en" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleLanguageChange("en")}
                  className="flex items-center gap-2"
                >
                  🇺🇸 English
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI 设置 */}
        <AISettingsSection />

        {/* 应用设置 */}
        <Card>
          <CardHeader>
            <CardTitle>应用设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="font-medium">自动同步</h4>
                  <p className="text-sm text-muted-foreground">
                    自动同步 GitHub Star 项目
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={autoSyncEnabled ? "outline" : "secondary"}>
                    {advancedLoading
                      ? "加载中..."
                      : autoSyncEnabled
                        ? `每 ${autoSyncInterval} 分钟`
                        : "已关闭"}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                        disabled={advancedLoading || autoSyncUpdating}
                      >
                        {autoSyncUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        间隔
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[160px]">
                      <DropdownMenuRadioGroup
                        value={String(autoSyncInterval)}
                        onValueChange={handleAutoSyncIntervalChange}
                      >
                        {autoSyncOptions.map((option) => (
                          <DropdownMenuRadioItem
                            key={option}
                            value={String(option)}
                            disabled={autoSyncUpdating}
                          >
                            每 {option} 分钟
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant={autoSyncEnabled ? "destructive" : "outline"}
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={handleToggleAutoSync}
                    disabled={advancedLoading || autoSyncUpdating}
                  >
                    {autoSyncUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {autoSyncEnabled ? "关闭" : "开启"}
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="font-medium">缓存管理</h4>
                  <p className="text-sm text-muted-foreground">
                    清理本地缓存数据
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={handleClearCache}
                  disabled={cacheClearing}
                >
                  {cacheClearing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  清理缓存
                </Button>
              </div>
            </div>
            {appSettingsError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{appSettingsError}</span>
              </div>
            )}
            {cacheMessage && (
              <div className="text-sm text-muted-foreground">{cacheMessage}</div>
            )}
          </CardContent>
        </Card>

        {/* 高级设置 */}
        <Card>
          <CardHeader>
            <CardTitle>高级设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="font-medium">开发者模式</h4>
                  <p className="text-sm text-muted-foreground">
                    启用开发者工具和调试功能
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={developerMode ? "outline" : "secondary"}>
                    {advancedLoading
                      ? "加载中..."
                      : developerMode
                        ? "已开启"
                        : "已关闭"}
                  </Badge>
                  <Button
                    variant={developerMode ? "destructive" : "outline"}
                    size="sm"
                    onClick={handleToggleDeveloperMode}
                    disabled={advancedLoading || devModeUpdating}
                    className="flex items-center gap-2"
                  >
                    {devModeUpdating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {developerMode ? "关闭" : "开启"}
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="font-medium">日志级别</h4>
                  <p className="text-sm text-muted-foreground">
                    设置应用日志详细程度
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {advancedLoading ? "加载中..." : logLevelLabels[logLevel]}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex items-center gap-2"
                        disabled={advancedLoading || logLevelUpdating}
                      >
                        {logLevelUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        选择
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[180px]">
                      <DropdownMenuRadioGroup
                        value={logLevel}
                        onValueChange={(value) =>
                          handleLogLevelChange(value as LogLevel)
                        }
                      >
                        {(Object.keys(logLevelLabels) as LogLevel[]).map(
                          (level) => (
                            <DropdownMenuRadioItem
                              key={level}
                              value={level}
                              disabled={logLevelUpdating}
                            >
                              {logLevelLabels[level]}
                            </DropdownMenuRadioItem>
                          ),
                        )}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
            {advancedError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{advancedError}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 应用信息 */}
        <Card>
          <CardHeader>
            <CardTitle>应用信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">版本：</span>
                <span className="text-muted-foreground">1.0.0</span>
              </div>
              <div>
                <span className="font-medium">平台：</span>
                <span className="text-muted-foreground">Electron</span>
              </div>
              <div>
                <span className="font-medium">Node.js：</span>
                <span className="text-muted-foreground">20.x</span>
              </div>
              <div>
                <span className="font-medium">Electron：</span>
                <span className="text-muted-foreground">37.x</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Starepo - GitHub Star 智能管理工具
            </p>
          </CardContent>
        </Card>

        {/* 底部空间 */}
        <div className="h-10"></div>
      </div>
    </AppLayout>
  );
}
