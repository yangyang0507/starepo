import { RepositoryList, SearchAndFilter } from "@/components";
import { AppLayout } from "@/components/layout/app-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useRepositoryStore } from "@/stores/repository-store";
import { useAuthStore } from "@/stores/auth-store";
import { useExternalLink } from "@/hooks/use-external-link";
import type { FilterOptions, ViewOptions } from "@shared/types";
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ExternalLink,
  Github,
  Loader2,
  LogOut,
  RefreshCw,
  Star,
  User,
} from "lucide-react";
import React, { useEffect, useCallback, useMemo } from "react";

const GitHubRepositoriesPage: React.FC = () => {
  const { authState } = useAuthStore();
  const { openExternal } = useExternalLink();
  const {
    user,
    repositories,
    displayRepositories,
    starredRepoIds,
    loading,
    error,
    syncing,
    loadingProgress,
    totalLoaded,
    refreshMessage,
    viewOptions,
    currentPage,
    initializeData,
    refreshData,
    starRepository,
    unstarRepository,
    logout,
    checkAndUpdateCache,
    setSearchQuery,
    setFilterOptions,
    setViewOptions,
    setCurrentPage,
  } = useRepositoryStore();

  // Event handlers that use store actions
  const handleRefresh = refreshData;
  const handleStar = starRepository;
  const handleUnstar = unstarRepository;
  const handleLogout = logout;

  // 初始化 - 只有当全局认证状态确认已认证时才执行
  useEffect(() => {
    if (authState?.isAuthenticated && authState.user) {
      initializeData(authState.user as any);
    }
  }, [initializeData, authState?.isAuthenticated, authState?.user]);

  // 数据加载完成后检查缓存状态
  useEffect(() => {
    if (user && !loading) {
      checkAndUpdateCache();
    }
  }, [user, loading, checkAndUpdateCache]);

  const handleSearch = useCallback(
    (query: string) => {
      setCurrentPage(1); // Reset to first page on new search
      setSearchQuery(query);
    },
    [setSearchQuery, setCurrentPage],
  );

  const handleFilterChange = useCallback(
    (options: Partial<FilterOptions>) => {
      setCurrentPage(1); // Reset to first page on filter change
      setFilterOptions(options);
    },
    [setFilterOptions, setCurrentPage],
  );

  const handleViewChange = useCallback(
    (options: Partial<ViewOptions>) => {
      setViewOptions(options);
    },
    [setViewOptions],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      // Consider scrolling to top
    },
    [setCurrentPage],
  );

  // 分页逻辑
  const paginationInfo = useMemo(() => {
    const totalItems = displayRepositories.length;
    const { itemsPerPage } = viewOptions;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    return {
      currentPage,
      totalPages,
      totalItems,
      itemsPerPage,
      startIndex,
      endIndex,
    };
  }, [displayRepositories.length, viewOptions.itemsPerPage, currentPage]);

  const paginatedRepositories = useMemo(() => {
    return displayRepositories.slice(
      paginationInfo.startIndex,
      paginationInfo.endIndex,
    );
  }, [
    displayRepositories,
    paginationInfo.startIndex,
    paginationInfo.endIndex,
  ]);

  const renderPagination = () => {
    if (paginationInfo.totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 7;
    let startPage = Math.max(
      1,
      currentPage - Math.floor(maxVisiblePages / 2),
    );
    const endPage = Math.min(
      paginationInfo.totalPages,
      startPage + maxVisiblePages - 1,
    );

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    pages.push(
      <Button
        key="prev"
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        上一页
      </Button>,
    );

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Button
          key={i}
          variant={i === currentPage ? "default" : "outline"}
          size="sm"
          onClick={() => handlePageChange(i)}
        >
          {i}
        </Button>,
      );
    }

    pages.push(
      <Button
        key="next"
        variant="outline"
        size="sm"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === paginationInfo.totalPages}
      >
        下一页
        <ChevronRight className="ml-1 h-4 w-4" />
      </Button>,
    );

    return (
      <div className="mt-6 flex items-center justify-between px-6 pb-6">
        <div className="text-sm text-muted-foreground">
          显示第 <span className="font-medium">{paginationInfo.startIndex + 1}</span> 到 <span className="font-medium">{paginationInfo.endIndex}</span> 项，共 <span className="font-medium">{paginationInfo.totalItems}</span> 项
        </div>
        <div className="flex items-center gap-1">{pages}</div>
      </div>
    );
  };

  // 如果未认证，显示认证提示
  if (!authState?.isAuthenticated) {
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
                  <h1 className="text-xl font-semibold mb-2">
                    GitHub 仓库管理
                  </h1>
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
      <div className="flex flex-col gap-4 p-2 sm:p-4 pt-0 h-full overflow-y-auto">
        {/* 用户信息卡片 */}
        {user && (
          <div className="flex-shrink-0 bg-card rounded-lg border shadow-sm p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center">
              {/* 左侧：用户信息 */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => openExternal(`https://github.com/${user?.login}`)}
                  className="group flex-shrink-0 relative"
                >
                  <Avatar className="h-16 w-16 sm:h-20 sm:w-20 ring-4 ring-background shadow-md group-hover:scale-105 transition-transform">
                    <AvatarImage src={user.avatar_url} alt={user.login} />
                    <AvatarFallback>
                      <User className="h-8 w-8 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 shadow-sm">
                    <Github className="h-4 w-4 text-foreground" />
                  </div>
                </button>

                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                      {user.name || user.login}
                    </h2>
                  </div>
                  <p className="text-muted-foreground font-mono text-sm">@{user.login}</p>
                  {user.bio && (
                    <p className="text-sm text-muted-foreground max-w-md line-clamp-1">
                      {user.bio}
                    </p>
                  )}
                </div>
              </div>

              {/* 右侧：数据与操作 */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-8 w-full sm:w-auto">
                <div className="flex items-center justify-around sm:justify-start gap-6 sm:gap-8">
                  <div className="text-center sm:text-left">
                    <p className="text-sm text-muted-foreground">已标星</p>
                    <p className="text-2xl font-bold tracking-tight">{repositories.length}</p>
                  </div>
                  <div className="w-px h-10 bg-border hidden sm:block" />
                  <div className="text-center sm:text-left">
                    <p className="text-sm text-muted-foreground">公开仓库</p>
                    <p className="text-2xl font-bold tracking-tight">{user.public_repos || 0}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={syncing}
                    size="sm"
                    className="flex-1 sm:flex-none h-9"
                  >
                    {syncing ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    刷新
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleLogout}
                    title="登出"
                    className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  >
                    <LogOut className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 加载进度指示器 */}
        {(loadingProgress !== null || loading) && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">
                      {loadingProgress !== null
                        ? `正在加载仓库... (${totalLoaded} 个已加载)`
                        : "正在初始化..."}
                    </span>
                    {loadingProgress !== null && (
                      <span className="font-medium">{loadingProgress}%</span>
                    )}
                  </div>
                  {loadingProgress !== null && (
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${loadingProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 刷新提示消息 */}
        {refreshMessage && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                {refreshMessage.includes("刷新完成") ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <span
                  className={`text-sm font-medium ${refreshMessage.includes("刷新完成")
                    ? "text-green-600"
                    : "text-destructive"
                    }`}
                >
                  {refreshMessage}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 搜索和过滤区域 - 嵌入式设计 */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-1 pt-1">
          <SearchAndFilter
            onSearch={handleSearch}
            loading={loading || syncing}
            totalCount={displayRepositories.length}
            className="pb-2"
          />
        </div>

        {/* 仓库列表区域 */}
        <div className="flex-col min-h-0 space-y-4">
          {error && (
            <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <RepositoryList
            repositories={paginatedRepositories}
            starredRepoIds={starredRepoIds}
            loading={loading}
            onStar={handleStar}
            onUnstar={handleUnstar}
          />

          <div className="pt-4 pb-8">
            {renderPagination()}
          </div>
        </div>

        {/* 底部间隙 */}
        <div className="h-20"></div>
      </div>
    </AppLayout>
  );
};

export default GitHubRepositoriesPage;
