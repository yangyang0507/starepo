import React, { useState, useEffect, useCallback } from "react";
import { RepositoryList } from "@/components";
import { githubServices } from "@/services/github";
import { AppLayout } from "@/components/layout/app-layout";
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
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold">GitHub 仓库管理</h1>
            <p className="mb-6 text-gray-600">
              请先进行 GitHub 认证以访问您的仓库
            </p>
            <button
              onClick={() => (window.location.href = "/github-auth")}
              className="rounded-lg bg-blue-600 px-6 py-2 text-white transition-colors hover:bg-blue-700"
            >
              前往认证
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="GitHub 仓库管理">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 页面头部 */}
        <div className="border-b bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                GitHub 仓库管理
              </h1>
              {state.user && (
                <span className="ml-4 text-sm text-gray-600">
                  欢迎, {state.user.login}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                disabled={state.syncing}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {state.syncing ? "同步中..." : "刷新"}
              </button>
              <button
                onClick={handleLogout}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                登出
              </button>
            </div>
          </div>
        </div>

        {/* 主内容 */}
        <div className="flex-1 overflow-auto bg-gray-50 p-6">
          {state.error && (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-red-800">{state.error}</p>
            </div>
          )}

          <RepositoryList
            repositories={state.repositories}
            starredRepoIds={state.starredRepoIds}
            loading={state.loading}
            onStar={handleStar}
            onUnstar={handleUnstar}
          />
        </div>
      </div>
    </AppLayout>
  );
};

export default GitHubRepositoriesPage;
