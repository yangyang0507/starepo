/**
 * 高级设置区块
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { AlertCircle, Loader2, Shield } from 'lucide-react';
import { settingsAPI, logLevelLabels } from '@/api/settings';
import type { LogLevel } from '@shared/types';

export function AdvancedSection() {
  const [developerMode, setDeveloperMode] = useState(false);
  const [logLevel, setLogLevelState] = useState<LogLevel>('info');
  const [advancedLoading, setAdvancedLoading] = useState(true);
  const [devModeUpdating, setDevModeUpdating] = useState(false);
  const [logLevelUpdating, setLogLevelUpdating] = useState(false);
  const [advancedError, setAdvancedError] = useState<string | null>(null);

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          高级设置
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          {/* 开发者模式 */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="font-medium">开发者模式</h4>
              <p className="text-sm text-muted-foreground">
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

          <Separator />

          {/* 日志级别 */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="font-medium">日志级别</h4>
              <p className="text-sm text-muted-foreground">
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
        </div>

        {/* 错误消息 */}
        {advancedError && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{advancedError}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}