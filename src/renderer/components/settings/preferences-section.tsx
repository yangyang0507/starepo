/**
 * 偏好设置区块
 * 包含外观设置和高级设置
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertCircle, Globe, Loader2, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '@/utils/language-helpers';
import { settingsAPI, logLevelLabels } from '@/api/settings';
import type { ThemeMode, LogLevel } from '@shared/types';

export function PreferencesSection() {
  const { theme, changeTheme, isLoading: themeLoading } = useTheme();
  const { i18n } = useTranslation();

  // 高级设置相关
  const [developerMode, setDeveloperMode] = useState(false);
  const [logLevel, setLogLevelState] = useState<LogLevel>('info');
  const [advancedLoading, setAdvancedLoading] = useState(true);
  const [devModeUpdating, setDevModeUpdating] = useState(false);
  const [logLevelUpdating, setLogLevelUpdating] = useState(false);
  const [advancedError, setAdvancedError] = useState<string | null>(null);

  // 加载高级设置
  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        const currentSettings = await settingsAPI.getSettings();
        if (!mounted) return;

        setDeveloperMode(currentSettings.developerMode ?? false);
        setLogLevelState(currentSettings.logLevel ?? 'info');
      } catch (error) {
        if (!mounted) return;
        setAdvancedError(
          error instanceof Error ? error.message : '加载设置失败'
        );
      } finally {
        if (mounted) {
          setAdvancedLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  const getThemeIcon = (themeMode: ThemeMode) => {
    switch (themeMode) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'system':
        return <Monitor className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getThemeLabel = (themeMode: ThemeMode) => {
    switch (themeMode) {
      case 'light':
        return '浅色';
      case 'dark':
        return '深色';
      case 'system':
        return '跟随系统';
      default:
        return '跟随系统';
    }
  };

  const getLanguageLabel = (lang: string) => {
    switch (lang) {
      case 'zh-CN':
        return '🇨🇳 中文简体';
      case 'en':
        return '🇺🇸 English';
      default:
        return '🇺🇸 English';
    }
  };

  const handleLanguageChange = async (lang: string) => {
    await setAppLanguage(lang);
  };

  const handleToggleDeveloperMode = async () => {
    setDevModeUpdating(true);
    setAdvancedError(null);
    try {
      const newValue = !developerMode;
      await settingsAPI.updateSettings({ developerMode: newValue });
      setDeveloperMode(newValue);
    } catch (error) {
      setAdvancedError(
        error instanceof Error ? error.message : '更新设置失败'
      );
    } finally {
      setDevModeUpdating(false);
    }
  };

  const handleLogLevelChange = async (level: LogLevel) => {
    setLogLevelUpdating(true);
    setAdvancedError(null);
    try {
      await settingsAPI.updateSettings({ logLevel: level });
      setLogLevelState(level);
    } catch (error) {
      setAdvancedError(
        error instanceof Error ? error.message : '更新设置失败'
      );
    } finally {
      setLogLevelUpdating(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">偏好设置</h2>
          <p className="text-sm text-muted-foreground mt-1">
            自定义应用的外观和高级选项
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* 外观设置 */}
        <div>
          <h3 className="text-base font-semibold mb-4">外观</h3>
          <div className="space-y-5">
            {/* 主题设置 */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">主题模式</p>
                <p className="text-xs text-muted-foreground">
                  选择应用的外观主题
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[140px] justify-start"
                    disabled={themeLoading}
                  >
                    {getThemeIcon(theme)}
                    <span className="ml-2">{getThemeLabel(theme)}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={theme}
                    onValueChange={(value) => changeTheme(value as ThemeMode)}
                  >
                    <DropdownMenuRadioItem value="light">
                      <Sun className="mr-2 h-4 w-4" />
                      浅色
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">
                      <Moon className="mr-2 h-4 w-4" />
                      深色
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system">
                      <Monitor className="mr-2 h-4 w-4" />
                      跟随系统
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* 语言设置 */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">语言</p>
                <p className="text-xs text-muted-foreground">
                  选择应用的显示语言
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-[140px] justify-start">
                    <Globe className="mr-2 h-4 w-4" />
                    {getLanguageLabel(i18n.language)}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={i18n.language}
                    onValueChange={handleLanguageChange}
                  >
                    <DropdownMenuRadioItem value="zh-CN">
                      🇨🇳 中文简体
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="en">
                      🇺🇸 English
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <Separator />

        {/* 高级设置 */}
        <div>
          <h3 className="text-base font-semibold mb-4">高级选项</h3>
          <div className="space-y-5">
            {/* 开发者模式 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">开发者模式</p>
                <p className="text-xs text-muted-foreground">
                  启用开发者工具和调试功能
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={developerMode ? 'outline' : 'secondary'}>
                  {advancedLoading
                    ? '加载中...'
                    : developerMode
                      ? '已开启'
                      : '已关闭'}
                </Badge>
                <Button
                  variant={developerMode ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={handleToggleDeveloperMode}
                  disabled={advancedLoading || devModeUpdating}
                  className="flex items-center gap-2"
                >
                  {devModeUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {developerMode ? '关闭' : '开启'}
                </Button>
              </div>
            </div>

            {/* 日志级别 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">日志级别</p>
                <p className="text-xs text-muted-foreground">
                  设置应用日志详细程度
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {advancedLoading ? '加载中...' : logLevelLabels[logLevel]}
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
                        )
                      )}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* 错误消息 */}
            {advancedError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{advancedError}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
