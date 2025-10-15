import TokenManagement from "@/components/github/token-management";
import { AppLayout } from "@/components/layout/app-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useAuthStore } from "@/stores/auth-store";
import { useRepositoryStore } from "@/stores/repository-store";
import { setAppLanguage } from "@/utils/language-helpers";
import type { ThemeMode, LogLevel } from "@shared/types";
import {
  AlertCircle,
  CheckCircle,
  Edit2,
  ExternalLink,
  Github,
  Globe,
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
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { settingsAPI, logLevelLabels } from "@/api/settings";
import { configureAutoSync, triggerAutoSyncNow } from "@/hooks/use-auto-sync";

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

  // 处理外部链接跳转
  const handleExternalLink = async (url: string) => {
    try {
      if (window.electronAPI?.shell?.openExternal) {
        const result = await window.electronAPI.shell.openExternal(url);
        if (!result.success) {
          console.error("打开外部链接失败:", result.error);
          // 如果 Electron API 失败，尝试备用方案
          window.open(url, '_blank');
        }
      } else {
        // 备用方案：在默认浏览器中打开
        window.open(url, '_blank');
      }
    } catch (error) {
      console.error("打开链接时发生错误:", error);
      // 最后的备用方案
      window.open(url, '_blank');
    }
  };

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
