/**
 * GitHub 账户设置区块
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  CheckCircle,
  Edit2,
  ExternalLink,
  Github,
  Key,
  LogOut,
  RefreshCw,
  User,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useRepositoryStore } from '@/stores/repository-store';
import { useExternalLink } from '@/hooks/use-external-link';
import TokenManagement from '@/components/github/token-management';

export function GitHubAccountSection() {
  const [showTokenManagement, setShowTokenManagement] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { authState, refreshAuth, logout } = useAuthStore();
  const { openExternal: handleExternalLink } = useExternalLink();

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await refreshAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('确定要退出登录吗？')) {
      await logout();
    }
  };

  if (!authState?.isAuthenticated) {
    return (
      <>
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

        {showTokenManagement && (
          <TokenManagement onClose={() => setShowTokenManagement(false)} />
        )}
      </>
    );
  }

  return (
    <>
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
          </div>

          <Separator />

          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              刷新信息
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTokenManagement(true)}
            >
              <Edit2 className="mr-2 h-4 w-4" />
              管理 Token
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="text-destructive hover:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </Button>
          </div>
        </CardContent>
      </Card>

      {showTokenManagement && (
        <TokenManagement onClose={() => setShowTokenManagement(false)} />
      )}
    </>
  );
}