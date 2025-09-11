import React from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import RepositoryCard from "@/components/repository-card";
import { useRepositoryStore } from "@/stores/repository-store";
import type {
  GitHubRepository,
} from "@/services/github/types";

interface RepositoryListProps {
  repositories: GitHubRepository[];
  starredRepoIds: Set<number>;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onStar?: (repo: GitHubRepository) => Promise<void>;
  onUnstar?: (repo: GitHubRepository) => Promise<void>;
  className?: string;
}

export const RepositoryList: React.FC<RepositoryListProps> = ({
  repositories,
  starredRepoIds,
  loading = false,
  error = null,
  onRefresh,
  onStar,
  onUnstar,
  className = "",
}) => {
  const { viewOptions } = useRepositoryStore();

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-12 ${className}`}
      >
        <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
        <h3 className="mb-2 text-lg font-medium">加载失败</h3>
        <p className="mb-4 max-w-md text-center text-muted-foreground">
          {error}
        </p>
        {onRefresh && (
          <Button onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            重试
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* 内容区域 */}
      <div className="flex-1 p-3 sm:p-6">
        {loading && repositories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">正在加载仓库...</p>
          </div>
        ) : repositories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 text-6xl">📦</div>
            <h3 className="mb-2 text-lg font-medium">未找到匹配的仓库</h3>
            <p className="max-w-md text-center text-muted-foreground">
              请尝试调整搜索或筛选条件。
            </p>
          </div>
        ) : (
          <>
            {/* 仓库网格/列表 */}
            <div
              className={`${
                viewOptions.layout === "grid"
                  ? "grid grid-cols-1 gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                  : "space-y-3 sm:space-y-4"
              }`}
            >
              {repositories.map((repo) => (
                <RepositoryCard
                  key={repo.id}
                  repository={repo}
                  viewOptions={viewOptions}
                  onStar={onStar}
                  onUnstar={onUnstar}
                  isStarred={starredRepoIds.has(repo.id)}
                  loading={loading}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* 加载更多指示器 */}
      {loading && repositories.length > 0 && (
        <div className="flex items-center justify-center border-t py-4">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
          <span className="text-muted-foreground">正在更新...</span>
        </div>
      )}
    </div>
  );
};

export default RepositoryList;
