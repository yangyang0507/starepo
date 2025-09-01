import { RepositoryList } from "@/components";
import { AppLayout } from "@/components/layout/app-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { githubServices } from "@/services/github";
import type { GitHubRepository, GitHubUser } from "@/services/github/types";
import { indexedDBStorage } from "@/services/indexeddb-storage";
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Github,
  Loader2,
  LogOut,
  RefreshCw,
  Star,
  User
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface GitHubRepositoriesPageState {
  user: GitHubUser | null;
  repositories: GitHubRepository[];
  starredRepoIds: Set<number>;
  loading: boolean;
  error: string | null;
  syncing: boolean;
  // 一次性加载相关状态
  loadingProgress: number | null; // 加载进度 (0-100)
  totalLoaded: number;
  // 缓存相关状态
  fromCache: boolean; // 数据是否来自缓存
  cacheStatus: {
    hasCache: boolean;
    isFresh: boolean;
    lastUpdated?: Date;
    totalCount?: number;
  } | null;
}

const GitHubRepositoriesPage: React.FC = () => {
  const [state, setState] = useState<GitHubRepositoriesPageState>({
    user: null,
    repositories: [],
    starredRepoIds: new Set(),
    loading: true,
    error: null,
    syncing: false,
    loadingProgress: null,
    totalLoaded: 0,
    fromCache: false,
    cacheStatus: null,
  });

  // 防抖引用，避免快速的状态变化
  const lastUpdateRef = useRef<number>(0);

  // 防抖状态设置函数，避免快速闪烁
  const debouncedSetState = useCallback((updater: (prev: GitHubRepositoriesPageState) => GitHubRepositoriesPageState) => {
    const now = Date.now();
    if (now - lastUpdateRef.current > 100) { // 最小间隔100ms
      lastUpdateRef.current = now;
      setState(updater);
    }
  }, []);

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

      // 获取所有Star仓库列表（一次性加载完毕）
      const starredData = await githubServices.star.getAllStarredRepositories({
        batchSize: 100,
        onProgress: (loaded, total) => {
          // 更新加载进度
          const progress = total ? Math.round((loaded / total) * 100) : null;
          setState((prev) => ({
            ...prev,
            loadingProgress: progress,
            totalLoaded: loaded,
          }));
        },
      });

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
        loadingProgress: null,
        totalLoaded: starredData.totalLoaded,
        fromCache: starredData.fromCache || false,
        cacheStatus: null, // 稍后会更新缓存状态
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
  const handleRefresh = useCallback(async (forceRefresh: boolean = false) => {
    // 防止重复刷新
    if (state.syncing) return;

    setState((prev) => ({ ...prev, syncing: true, error: null }));

    try {
      // 重新获取所有数据
      const starredData = await githubServices.star.getAllStarredRepositories({
        batchSize: 100,
        forceRefresh, // 支持强制刷新
        onProgress: (loaded, total) => {
          // 更新加载进度
          const progress = total ? Math.round((loaded / total) * 100) : null;
          setState((prev) => ({
            ...prev,
            loadingProgress: progress,
            totalLoaded: loaded,
          }));
        },
      });

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
        loadingProgress: null,
        totalLoaded: starredData.totalLoaded,
        fromCache: starredData.fromCache || false,
      }));
    } catch (error) {
      console.error("刷新失败:", error);
      setState((prev) => ({
        ...prev,
        syncing: false,
        error: error instanceof Error ? error.message : "刷新失败，请稍后重试",
      }));
    }
  }, [state.syncing]);

  // 普通刷新（使用缓存）
  const handleNormalRefresh = useCallback(() => {
    handleRefresh(false);
  }, [handleRefresh]);

  // 强制刷新（忽略缓存）
  const handleForceRefresh = useCallback(() => {
    handleRefresh(true);
  }, [handleRefresh]);


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
        loadingProgress: null,
        totalLoaded: 0,
        fromCache: false,
        cacheStatus: null,
      });
    } catch (error) {
      console.error("登出失败:", error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "登出失败，请稍后重试",
      }));
    }
  }, []);

  // 异步检查和更新缓存
  const checkAndUpdateCache = useCallback(async () => {
    if (!state.user) return;

    try {
      const cacheStatus = await indexedDBStorage.getCacheStatus(state.user.login);

      setState((prev) => ({
        ...prev,
        cacheStatus,
      }));

      // 如果有缓存但已过期，启动后台更新
      if (cacheStatus.hasCache && !cacheStatus.isFresh) {
        console.log("缓存已过期，启动后台更新...");
        // 异步更新，不阻塞UI
        githubServices.star.getAllStarredRepositories({
          forceRefresh: true,
          batchSize: 100,
          onProgress: (loaded) => {
            // 后台更新不显示进度，只在控制台记录
            console.log(`后台更新进度: ${loaded} 个仓库`);
          },
        }).then((result) => {
          console.log(`后台更新完成，共 ${result.totalLoaded} 个仓库`);
          // 更新缓存状态
          setState((prev) => ({
            ...prev,
            cacheStatus: {
              hasCache: true,
              isFresh: true,
              lastUpdated: new Date(),
              totalCount: result.totalLoaded,
            },
          }));
        }).catch((error) => {
          console.warn("后台更新失败:", error);
        });
      }
    } catch (error) {
      console.warn("检查缓存状态失败:", error);
    }
  }, [state.user]);

  // 初始化
  useEffect(() => {
    initializeData();

    // 清理函数
    return () => {
      githubServices.sync.stopSync();
    };
  }, [initializeData]);

  // 数据加载完成后检查缓存状态
  useEffect(() => {
    if (state.user && !state.loading) {
      checkAndUpdateCache();
    }
  }, [state.user, state.loading, checkAndUpdateCache]);

  // 监听同步事件
  useEffect(() => {
    const handleSyncComplete = () => {
      // 同步完成后只更新同步状态，不重新获取数据
      debouncedSetState((prev) => ({
        ...prev,
        syncing: false,
        error: null,
      }));
    };

    const handleSyncError = (error: unknown) => {
      debouncedSetState((prev) => ({
        ...prev,
        syncing: false,
        error: error instanceof Error ? error.message : "同步失败",
      }));
    };

    const syncService = githubServices.sync;
    syncService.addEventListener(handleSyncComplete);
    syncService.addEventListener(handleSyncError);

    return () => {
      syncService.removeEventListener(handleSyncComplete);
      syncService.removeEventListener(handleSyncError);
    };
  }, [debouncedSetState]);

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

      <div className="flex flex-1 flex-col gap-4 p-2 sm:p-4 pt-0">
        {/* 用户信息卡片 */}
        {state.user && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Github className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="truncate">GitHub 连接状态</span>
                <Badge variant="outline" className="ml-auto text-green-600 border-green-600 text-xs">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  已连接
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                <button
                  onClick={() => window.open(`https://github.com/${state.user?.login}`, '_blank')}
                  className="group flex-shrink-0"
                >
                  <Avatar className="h-12 w-12 sm:h-16 sm:w-16 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                    <AvatarImage
                      src={state.user.avatar_url}
                      alt={state.user.login}
                    />
                    <AvatarFallback>
                      <User className="h-6 w-6 sm:h-8 sm:w-8" />
                    </AvatarFallback>
                  </Avatar>
                </button>
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <button
                      onClick={() => window.open(`https://github.com/${state.user?.login}`, '_blank')}
                      className="group text-left w-full"
                    >
                      <h3 className="font-semibold text-base sm:text-lg group-hover:text-primary transition-colors flex items-center gap-2 truncate">
                        <span className="truncate">{state.user.name || state.user.login}</span>
                        <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </h3>
                    </button>
                    <button
                      onClick={() => window.open(`https://github.com/${state.user?.login}`, '_blank')}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors truncate block"
                    >
                      @{state.user.login}
                    </button>
                  </div>
                  {state.user.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {state.user.bio}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 sm:gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Star className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium">{state.repositories.length}</span>
                      <span className="hidden xs:inline">已标星</span>
                    </div>
                    <button
                      onClick={() => window.open(`https://github.com/${state.user?.login}?tab=repositories`, '_blank')}
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
                    >
                      <span className="font-medium">{state.user.public_repos || 0}</span>
                      <span className="hidden xs:inline">仓库</span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    onClick={handleNormalRefresh}
                    disabled={state.syncing}
                    size="sm"
                    className="flex-1 sm:flex-none"
                  >
                    {state.syncing ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    <span className="xs:inline">刷新</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleForceRefresh}
                    disabled={state.syncing}
                    size="sm"
                    className="flex-1 sm:flex-none"
                    title="强制从GitHub重新获取所有数据"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    <span className="xs:inline">强制刷新</span>
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleLogout}
                    size="sm"
                    className="flex-1 sm:flex-none"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span className="xs:inline">登出</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 加载进度指示器 */}
        {(state.loadingProgress !== null || state.loading) && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">
                      {state.loadingProgress !== null
                        ? `正在加载仓库... (${state.totalLoaded} 个已加载)`
                        : "正在初始化..."
                      }
                    </span>
                    {state.loadingProgress !== null && (
                      <span className="font-medium">{state.loadingProgress}%</span>
                    )}
                  </div>
                  {state.loadingProgress !== null && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${state.loadingProgress}%` }}
                      />
                    </div>
                  )}
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
