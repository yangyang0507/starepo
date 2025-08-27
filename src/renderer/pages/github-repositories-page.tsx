import React, { useState, useEffect, useCallback } from "react";
import { RepositoryList } from "@/components";
import { githubServices } from "@/services/github";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Github,
  Star,
  RefreshCw,
  LogOut,
  User,
  ExternalLink,
  AlertCircle,
  CheckCircle
} from "lucide-react";
import type { GitHubUser, GitHubRepository } from "@/services/github/types";

interface GitHubRepositoriesPageState {
  user: GitHubUser | null;
  repositories: GitHubRepository[];
  starredRepoIds: Set<number>;
  loading: boolean;
  error: string | null;
  syncing: boolean;
}

const GitHubRepositoriesPage: React.FC = () => {
  const [state, setState] = useState<GitHubRepositoriesPageState>({
    user: null,
    repositories: [],
    starredRepoIds: new Set(),
    loading: true,
    error: null,
    syncing: false,
  });

  // 初始化数据
  const initializeData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // 检查认证状态
      const isAuthenticated = await githubServices.auth.isAuthenticated();
      if (!isAuthenticated) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "请先进行GitHub认证",
        }));
        return;
      }

      // 获取用户信息
      const user = await githubServices.user.getCurrentUser();

      // 获取Star仓库列表
      const starredData = await githubServices.star.getStarredRepositories();
      const repositories = starredData.repositories.map((starredRepo) => ({
        ...starredRepo,
        // 移除starred_at字段，保持GitHubRepository类型一致
        starred_at: undefined,
      })) as GitHubRepository[];

      const starredRepoIds = new Set(repositories.map((repo) => repo.id));

      setState({
        user,
        repositories,
        starredRepoIds,
        loading: false,
        error: null,
        syncing: false,
      });

      // 启动同步服务
      await githubServices.sync.startIncrementalSync();
    } catch (error) {
      console.error("初始化失败:", error);
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          error instanceof Error ? error.message : "初始化失败，请稍后重试",
      }));
    }
  }, []);

  // 刷新数据
  const handleRefresh = useCallback(async () => {
    setState((prev) => ({ ...prev, syncing: true, error: null }));

    try {
      // 重新获取数据
      const starredData = await githubServices.star.getStarredRepositories();
      const repositories = starredData.repositories.map((starredRepo) => ({
        ...starredRepo,
        starred_at: undefined,
      })) as GitHubRepository[];

      const starredRepoIds = new Set(repositories.map((repo) => repo.id));

      setState((prev) => ({
        ...prev,
        repositories,
        starredRepoIds,
        syncing: false,
      }));
    } catch (error) {
      console.error("刷新失败:", error);
      setState((prev) => ({
        ...prev,
        syncing: false,
        error: error instanceof Error ? error.message : "刷新失败，请稍后重试",
      }));
    }
  }, []);

  // Star操作
  const handleStar = useCallback(async (repo: GitHubRepository) => {
    try {
      await githubServices.star.starRepository(repo.owner.login, repo.name);
      setState((prev) => ({
        ...prev,
        starredRepoIds: new Set([...prev.starredRepoIds, repo.id]),
      }));
    } catch (error) {
      console.error("Star操作失败:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : "Star操作失败，请稍后重试",
      }));
    }
  }, []);

  // Unstar操作
  const handleUnstar = useCallback(async (repo: GitHubRepository) => {
    try {
      await githubServices.star.unstarRepository(repo.owner.login, repo.name);
      setState((prev) => {
        const newStarredRepoIds = new Set(prev.starredRepoIds);
        newStarredRepoIds.delete(repo.id);
        return {
          ...prev,
          starredRepoIds: newStarredRepoIds,
        };
      });
    } catch (error) {
      console.error("Unstar操作失败:", error);
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : "Unstar操作失败，请稍后重试",
      }));
    }
  }, []);

  // 登出
  const handleLogout = useCallback(async () => {
    try {
      await githubServices.auth.clearAuth();
      setState({
        user: null,
        repositories: [],
        starredRepoIds: new Set(),
        loading: false,
        error: null,
        syncing: false,
      });
    } catch (error) {
      console.error("登出失败:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "登出失败，请稍后重试",
      }));
    }
  }, []);

  // 初始化
  useEffect(() => {
    initializeData();

    // 清理函数
    return () => {
      githubServices.sync.stopSync();
    };
  }, [initializeData]);

  // 监听同步事件
  useEffect(() => {
    const handleSyncComplete = async () => {
      // 同步完成后只刷新数据，不重新启动同步
      setState((prev) => ({ ...prev, syncing: true, error: null }));

      try {
        const starredData = await githubServices.star.getStarredRepositories();
        const repositories = starredData.repositories.map((starredRepo) => ({
          ...starredRepo,
          starred_at: undefined,
        })) as GitHubRepository[];

        const starredRepoIds = new Set(repositories.map((repo) => repo.id));

        setState((prev) => ({
          ...prev,
          repositories,
          starredRepoIds,
          syncing: false,
          error: null,
        }));
      } catch (error) {
        console.error("刷新数据失败:", error);
        setState((prev) => ({
          ...prev,
          syncing: false,
          error: error instanceof Error ? error.message : "刷新数据失败",
        }));
      }
    };

    const handleSyncError = (error: any) => {
      setState((prev) => ({
        ...prev,
        syncing: false,
        error: error?.message || "同步失败",
      }));
    };

    const syncService = githubServices.sync;
    syncService.addEventListener(handleSyncComplete);
    syncService.addEventListener(handleSyncError);

    return () => {
      syncService.removeEventListener(handleSyncComplete);
      syncService.removeEventListener(handleSyncError);
    };
  }, [initializeData]);

  // 如果未认证，显示认证提示
  if (!state.user && !state.loading) {
    return (
      <AppLayout title="GitHub 仓库管理">
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <h1 className="text-base font-medium">GitHub 仓库管理</h1>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <Github className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold mb-2">GitHub 仓库管理</h1>
                  <p className="text-muted-foreground">
                    请先进行 GitHub 认证以访问您的仓库
                  </p>
                </div>
                <Button
                  onClick={() => (window.location.href = "/github-auth")}
                  className="w-full"
                >
                  <Github className="mr-2 h-4 w-4" />
                  前往认证
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="GitHub 仓库管理">
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="text-base font-medium">GitHub 仓库管理</h1>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* 用户信息卡片 */}
        {state.user && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Github className="h-5 w-5" />
                GitHub 连接状态
                <Badge variant="outline" className="ml-auto text-green-600 border-green-600">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  已连接
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-4">
                <button
                  onClick={() => window.open(`https://github.com/${state.user?.login}`, '_blank')}
                  className="group"
                >
                  <Avatar className="h-16 w-16 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                    <AvatarImage
                      src={state.user.avatar_url}
                      alt={state.user.login}
                    />
                    <AvatarFallback>
                      <User className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                </button>
                <div className="flex-1 space-y-2">
                  <div>
                    <button
                      onClick={() => window.open(`https://github.com/${state.user?.login}`, '_blank')}
                      className="group text-left"
                    >
                      <h3 className="font-semibold text-lg group-hover:text-primary transition-colors flex items-center gap-2">
                        {state.user.name || state.user.login}
                        <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h3>
                    </button>
                    <button
                      onClick={() => window.open(`https://github.com/${state.user?.login}`, '_blank')}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      @{state.user.login}
                    </button>
                  </div>
                  {state.user.bio && (
                    <p className="text-sm text-muted-foreground">
                      {state.user.bio}
                    </p>
                  )}
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Star className="h-4 w-4" />
                      <span className="font-medium">{state.repositories.length}</span>
                      <span>已标星</span>
                    </div>
                    <button
                      onClick={() => window.open(`https://github.com/${state.user?.login}?tab=repositories`, '_blank')}
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
                    >
                      <span className="font-medium">{state.user.public_repos || 0}</span>
                      <span>仓库</span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={state.syncing}
                    size="sm"
                  >
                    {state.syncing ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    刷新
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleLogout}
                    size="sm"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    登出
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 仓库列表卡片 */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Star 仓库列表
              {state.repositories.length > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {state.repositories.length} 个仓库
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {state.error && (
              <div className="p-6">
                <div className="flex items-center gap-2 text-destructive mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">错误提示</span>
                </div>
                <p className="text-sm text-muted-foreground">{state.error}</p>
              </div>
            )}

            <RepositoryList
              repositories={state.repositories}
              starredRepoIds={state.starredRepoIds}
              loading={state.loading}
              onStar={handleStar}
              onUnstar={handleUnstar}
            />
          </CardContent>
        </Card>

        {/* 底部间隙 */}
        <div className="h-20"></div>
      </div>
    </AppLayout>
  );
};

export default GitHubRepositoriesPage;
