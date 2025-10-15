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
import type { FilterOptions, ViewOptions } from "@shared/types"
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
    console.log('全局认证状态:', authState);
    if (authState?.isAuthenticated && authState.user) {
      console.log('认证状态确认，开始初始化数据...');
      initializeData(authState.user as any);
    } else {
      console.log('认证状态未确认，跳过数据初始化');
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
        {user && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Github className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="truncate">GitHub 连接状态</span>
                <Badge
                  variant="outline"
                  className="ml-auto text-green-600 border-green-600 text-xs"
                >
                  <CheckCircle className="mr-1 h-3 w-3" />
                  已连接
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                <button
                  onClick={() =>
                    window.open(`https://github.com/${user?.login}`, "_blank")
                  }
                  className="group flex-shrink-0"
                >
                  <Avatar className="h-12 w-12 sm:h-16 sm:w-16 ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                    <AvatarImage src={user.avatar_url} alt={user.login} />
                    <AvatarFallback>
                      <User className="h-6 w-6 sm:h-8 sm:w-8" />
                    </AvatarFallback>
                  </Avatar>
                </button>
                <div className="flex-1 min-w-0 space-y-2">
                  <div>
                    <button
                      onClick={() =>
                        window.open(
                          `https://github.com/${user?.login}`,
                          "_blank",
                        )
                      }
                      className="group text-left w-full"
                    >
                      <h3 className="font-semibold text-base sm:text-lg group-hover:text-primary transition-colors flex items-center gap-2 truncate">
                        <span className="truncate">
                          {user.name || user.login}
                        </span>
                        <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </h3>
                    </button>
                    <button
                      onClick={() =>
                        window.open(
                          `https://github.com/${user?.login}`,
                          "_blank",
                        )
                      }
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors truncate block"
                    >
                      @{user.login}
                    </button>
                  </div>
                  {user.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {user.bio}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 sm:gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Star className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium">{repositories.length}</span>
                      <span className="hidden xs:inline">已标星</span>
                    </div>
                    <button
                      onClick={() =>
                        window.open(
                          `https://github.com/${user?.login}?tab=repositories`,
                          "_blank",
                        )
                      }
                      className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
                    >
                      <BookOpen className="h-4 w-4 flex-shrink-0" />
                      <span className="font-medium">
                        {user.public_repos || 0}
                      </span>
                      <span className="hidden xs:inline">仓库</span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={syncing}
                    size="sm"
                    className="flex-1 sm:flex-none"
                  >
                    {syncing ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    <span className="xs:inline">
                      {syncing ? "刷新中" : "刷新"}
                    </span>
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
                  className={`text-sm font-medium ${
                    refreshMessage.includes("刷新完成")
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

        <SearchAndFilter
          onSearch={handleSearch}
          onFilterChange={handleFilterChange}
          onViewChange={handleViewChange}
          loading={loading || syncing}
          totalCount={displayRepositories.length}
        />

        {/* 仓库列表卡片 */}
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Star 仓库列表
              {displayRepositories.length > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {displayRepositories.length} 个仓库
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 flex flex-col">
            {error && (
              <div className="p-6">
                <div className="flex items-center gap-2 text-destructive mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">错误提示</span>
                </div>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            )}

            <RepositoryList
              repositories={paginatedRepositories}
              starredRepoIds={starredRepoIds}
              loading={loading}
              onStar={handleStar}
              onUnstar={handleUnstar}
            />
          </CardContent>
          {renderPagination()}
        </Card>

        {/* 底部间隙 */}
        <div className="h-20"></div>
      </div>
    </AppLayout>
  );
};

export default GitHubRepositoriesPage;
