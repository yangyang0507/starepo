/**
 * GitHub 设置区块
 * 包含账户管理和同步设置
 */

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertCircle,
  CheckCircle,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  Key,
  Loader2,
  LogOut,
  MoreVertical,
  RefreshCw,
  User,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useExternalLink } from '@/hooks/use-external-link';
import { enhancedAuthAPI } from '@/api';
import { settingsAPI } from '@/api/settings';
import { configureAutoSync, triggerAutoSyncNow } from '@/hooks/use-auto-sync';

export function GitHubSection() {
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 同步设置相关
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncInterval, setAutoSyncInterval] = useState(15);
  const [autoSyncUpdating, setAutoSyncUpdating] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const autoSyncOptions = [5, 15, 30, 60];

  const { authState, refreshAuth, logout } = useAuthStore();
  const { openExternal: handleExternalLink } = useExternalLink();

  // 加载同步设置
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
        setSettingsError(
          error instanceof Error ? error.message : '加载设置失败'
        );
      }
    };

    void loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshAuth();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('确定要退出登录吗？')) {
      await logout();
    }
  };

  const handleAutoSyncToggle = async () => {
    setAutoSyncUpdating(true);
    setSettingsError(null);
    try {
      const newValue = !autoSyncEnabled;
      await settingsAPI.updateSettings({ autoSyncEnabled: newValue });
      setAutoSyncEnabled(newValue);
      await configureAutoSync({
        enabled: newValue,
        intervalMinutes: autoSyncInterval,
      });
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : '更新设置失败'
      );
    } finally {
      setAutoSyncUpdating(false);
    }
  };

  const handleIntervalChange = async (value: string) => {
    const newInterval = Number(value);
    setAutoSyncUpdating(true);
    setSettingsError(null);
    try {
      await settingsAPI.updateSettings({
        autoSyncIntervalMinutes: newInterval,
      });
      setAutoSyncInterval(newInterval);
      if (autoSyncEnabled) {
        await configureAutoSync({
          enabled: true,
          intervalMinutes: newInterval,
        });
      }
    } catch (error) {
      setSettingsError(
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

  const handleTokenSubmit = async () => {
    if (!token.trim()) return;

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const result = await enhancedAuthAPI.authenticateWithToken(token.trim());
      if (result.success) {
        setShowTokenDialog(false);
        setToken('');
        await refreshAuth();
      } else {
        setAuthError(result.error || '认证失败');
      }
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : '认证过程中发生错误'
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleOpenTokenDialog = () => {
    setToken('');
    setAuthError(null);
    setShowTokenDialog(true);
  };

  if (!authState?.isAuthenticated) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">GitHub 连接</h2>
            <p className="text-sm text-muted-foreground mt-1">
              连接你的 GitHub 账户以同步星标仓库
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>未连接到 GitHub</span>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <label htmlFor="token-input" className="text-sm font-medium">
                Personal Access Token
              </label>
              <div className="relative">
                <Input
                  id="token-input"
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  disabled={isAuthenticating}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && token.trim()) {
                      handleTokenSubmit();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={isAuthenticating}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                需要权限：user, public_repo（或 repo 访问私有仓库）
              </p>
            </div>

            {authError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{authError}</span>
              </div>
            )}

            <Button
              onClick={handleTokenSubmit}
              disabled={!token.trim() || isAuthenticating}
              className="w-full"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  连接中...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  连接 GitHub
                </>
              )}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>如何获取 Token：</p>
            <p>GitHub Settings → Developer settings → Personal access tokens → Generate new token</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">GitHub 连接</h2>
            <p className="text-sm text-muted-foreground mt-1">
              管理你的 GitHub 账户连接和同步设置
            </p>
          </div>
          <Badge variant="outline" className="text-green-600 border-green-600">
            <CheckCircle className="mr-1 h-3 w-3" />
            已连接
          </Badge>
        </div>

        <div className="space-y-6">
          {/* 用户信息 */}
          <div className="flex items-start gap-4">
            <button
              onClick={() => handleExternalLink(`https://github.com/${authState.user?.login}`)}
              className="group"
            >
              <Avatar className="h-16 w-16 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                <AvatarImage
                  src={authState.user?.avatar_url}
                  alt={authState.user?.login || '用户头像'}
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
                    {authState.user?.name || authState.user?.login || '未知用户'}
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
                  <span>正在关注</span>
                  <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            </div>
            {/* 账户操作菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRefresh} disabled={isRefreshing}>
                  <RefreshCw className={isRefreshing ? 'animate-spin' : ''} />
                  刷新信息
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenTokenDialog}>
                  <Edit2 />
                  更换 Token
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} variant="destructive">
                  <LogOut />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Separator />

          {/* 同步设置 */}
          <div>
            <h3 className="text-base font-semibold mb-4">同步设置</h3>
            <div className="space-y-5">
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
              {settingsError && (
                <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span>{settingsError}</span>
                </div>
              )}

              {/* 成功消息 */}
              {cacheMessage && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span>{cacheMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Token 更换对话框 */}
      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>更换 GitHub Token</DialogTitle>
            <DialogDescription>
              输入新的 Personal Access Token 来替换当前连接
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="new-token" className="text-sm font-medium">
                新 Token
              </label>
              <div className="relative">
                <Input
                  id="new-token"
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  disabled={isAuthenticating}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && token.trim()) {
                      handleTokenSubmit();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  disabled={isAuthenticating}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {authError && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{authError}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTokenDialog(false)}
              disabled={isAuthenticating}
            >
              取消
            </Button>
            <Button
              onClick={handleTokenSubmit}
              disabled={!token.trim() || isAuthenticating}
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  更换中...
                </>
              ) : (
                '确认更换'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
