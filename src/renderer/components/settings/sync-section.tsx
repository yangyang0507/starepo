/**
 * 同步设置区块
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertCircle, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { settingsAPI } from '@/api/settings';
import { configureAutoSync, triggerAutoSyncNow } from '@/hooks/use-auto-sync';

export function SyncSection() {
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncInterval, setAutoSyncInterval] = useState(15);
  const [autoSyncUpdating, setAutoSyncUpdating] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);
  const [appSettingsError, setAppSettingsError] = useState<string | null>(null);

  const autoSyncOptions = [5, 15, 30, 60];

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      try {
        const currentSettings = await settingsAPI.getSettings();
        if (!mounted) return;

        setAutoSyncEnabled(currentSettings.autoSyncEnabled ?? false);
        setAutoSyncInterval(currentSettings.autoSyncIntervalMinutes ?? 15);
      } catch (error) {
        if (!mounted) return;
        setAppSettingsError(
          error instanceof Error ? error.message : '加载设置失败'
        );
      }
    };

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  const handleAutoSyncToggle = async () => {
    setAutoSyncUpdating(true);
    setAppSettingsError(null);
    try {
      const newValue = !autoSyncEnabled;
      await settingsAPI.updateSettings({ autoSyncEnabled: newValue });
      setAutoSyncEnabled(newValue);
      await configureAutoSync(newValue, autoSyncInterval);
    } catch (error) {
      setAppSettingsError(
        error instanceof Error ? error.message : '更新设置失败'
      );
    } finally {
      setAutoSyncUpdating(false);
    }
  };

  const handleIntervalChange = async (value: string) => {
    const newInterval = Number(value);
    setAutoSyncUpdating(true);
    setAppSettingsError(null);
    try {
      await settingsAPI.updateSettings({
        autoSyncIntervalMinutes: newInterval,
      });
      setAutoSyncInterval(newInterval);
      if (autoSyncEnabled) {
        await configureAutoSync(true, newInterval);
      }
    } catch (error) {
      setAppSettingsError(
        error instanceof Error ? error.message : '更新设置失败'
      );
    } finally {
      setAutoSyncUpdating(false);
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm('确定要清除所有缓存吗？这将删除本地存储的所有仓库数据。')) {
      return;
    }

    setCacheClearing(true);
    setCacheMessage(null);
    try {
      await settingsAPI.clearCache();
      setCacheMessage('缓存已清除');
      setTimeout(() => setCacheMessage(null), 3000);
    } catch (error) {
      setCacheMessage(
        error instanceof Error ? error.message : '清除缓存失败'
      );
    } finally {
      setCacheClearing(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      await triggerAutoSyncNow();
      setCacheMessage('同步已触发');
      setTimeout(() => setCacheMessage(null), 3000);
    } catch (error) {
      setCacheMessage(
        error instanceof Error ? error.message : '触发同步失败'
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          同步设置
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 自动同步开关 */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">自动同步</p>
            <p className="text-xs text-muted-foreground">
              定期自动同步 GitHub 星标仓库
            </p>
          </div>
          <Button
            variant={autoSyncEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={handleAutoSyncToggle}
            disabled={autoSyncUpdating}
          >
            {autoSyncUpdating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {autoSyncEnabled ? '已启用' : '已禁用'}
          </Button>
        </div>

        {/* 同步间隔 */}
        {autoSyncEnabled && (
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">同步间隔</p>
              <p className="text-xs text-muted-foreground">
                设置自动同步的时间间隔
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={autoSyncUpdating}
                >
                  {autoSyncInterval} 分钟
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup
                  value={String(autoSyncInterval)}
                  onValueChange={handleIntervalChange}
                >
                  {autoSyncOptions.map((option) => (
                    <DropdownMenuRadioItem
                      key={option}
                      value={String(option)}
                    >
                      {option} 分钟
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* 立即同步 */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">立即同步</p>
            <p className="text-xs text-muted-foreground">
              手动触发一次同步操作
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSyncNow}>
            <RefreshCw className="mr-2 h-4 w-4" />
            同步
          </Button>
        </div>

        {/* 清除缓存 */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">清除缓存</p>
            <p className="text-xs text-muted-foreground">
              删除本地存储的所有仓库数据
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCache}
            disabled={cacheClearing}
          >
            {cacheClearing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            清除
          </Button>
        </div>

        {/* 错误消息 */}
        {appSettingsError && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span>{appSettingsError}</span>
          </div>
        )}

        {/* 成功消息 */}
        {cacheMessage && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span>{cacheMessage}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}