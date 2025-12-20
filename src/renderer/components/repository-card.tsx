import React, { useState, useCallback } from "react";
import {
  Star,
  GitFork,
  Eye,
  Calendar,
  ExternalLink,
  Archive,
  Lock,
  Tag,
} from "lucide-react";
import type { GitHubRepository, ViewOptions } from "@shared/types";
import { useExternalLink } from "@/hooks/use-external-link";

interface RepositoryCardProps {
  repository: GitHubRepository;
  viewOptions: ViewOptions;
  onStar?: (repo: GitHubRepository) => Promise<void>;
  onUnstar?: (repo: GitHubRepository) => Promise<void>;
  isStarred?: boolean;
  loading?: boolean;
  className?: string;
}

// 将工具函数移到组件外部，避免每次渲染时重新创建
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return "1天前";
  } else if (diffDays < 30) {
    return `${diffDays}天前`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months}个月前`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years}年前`;
  }
};

const getLanguageColor = (language: string | null): string => {
  const colors: Record<string, string> = {
    JavaScript: "#f1e05a",
    TypeScript: "#2b7489",
    Python: "#3572A5",
    Java: "#b07219",
    Go: "#00ADD8",
    Rust: "#dea584",
    "C++": "#f34b7d",
    "C#": "#239120",
    PHP: "#4F5D95",
    Ruby: "#701516",
    Swift: "#ffac45",
    Kotlin: "#F18E33",
    Dart: "#00B4AB",
    Shell: "#89e051",
    HTML: "#e34c26",
    CSS: "#1572B6",
  };
  return colors[language || ""] || "#6b7280";
};

const RepositoryCard: React.FC<RepositoryCardProps> = ({
  repository,
  viewOptions,
  onStar,
  onUnstar,
  isStarred = false,
  loading = false,
  className = "",
}) => {
  const [isStarring, setIsStarring] = useState(false);
  const [showRemainingTopics, setShowRemainingTopics] = useState(false);
  const { openExternal } = useExternalLink();

  const handleStarToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (isStarring || loading) return;

      setIsStarring(true);
      try {
        if (isStarred && onUnstar) {
          await onUnstar(repository);
          console.log(`取消收藏仓库 ${repository.name} 成功`);
        } else if (!isStarred && onStar) {
          await onStar(repository);
          console.log(`收藏仓库 ${repository.name} 成功`);
        }
      } catch (error) {
        console.error("Star 操作失败:", error);
      } finally {
        setIsStarring(false);
      }
    },
    [isStarred, isStarring, loading, onStar, onUnstar, repository],
  );

  const handleCardClick = useCallback(() => {
    openExternal(repository.html_url);
  }, [repository.html_url, openExternal]);

  const cardContent = (
    <>
      {/* 头部信息 */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1 sm:gap-2">
            <h3 className="truncate text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
              {repository.name}
            </h3>
            {repository.private && (
              <Lock className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            )}
            {repository.archived && (
              <Archive className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 text-yellow-500" />
            )}
            {repository.fork && (
              <GitFork className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            )}
          </div>
          <p className="truncate text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {repository.owner.login}
          </p>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
          <button
            onClick={handleStarToggle}
            disabled={isStarring || loading}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium transition-all duration-200 ${isStarred
              ? "bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-700 hover:from-yellow-200 hover:to-amber-200 hover:shadow-md dark:from-yellow-900/30 dark:to-amber-900/30 dark:text-yellow-300 dark:hover:from-yellow-900/40 dark:hover:to-amber-900/40"
              : "bg-gradient-to-r from-gray-100 to-gray-50 text-gray-700 hover:from-gray-200 hover:to-gray-100 hover:shadow-md dark:from-gray-700 dark:to-gray-600 dark:text-gray-300 dark:hover:from-gray-600 dark:hover:to-gray-500"
              } ${isStarring || loading ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:scale-105"}`}
          >
            <Star className={`h-3 w-3 sm:h-4 sm:w-4 ${isStarred ? "fill-current" : ""}`} />
            <span className="hidden xs:inline">{isStarred ? "Starred" : "Star"}</span>
            {isStarring && (
              <div className="h-3 w-3 animate-spin rounded-full border-b border-current"></div>
            )}
          </button>

          <button
            onClick={handleCardClick}
            className="p-1.5 sm:p-2 text-gray-500 transition-all duration-200 hover:text-gray-700 hover:bg-gray-100/50 hover:scale-110 rounded-lg dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700/50"
            title="在GitHub中打开"
          >
            <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>

      {/* 描述 - 固定高度以对齐 */}
      <div className="mb-4 h-10">
        {viewOptions.showDescription && repository.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground leading-relaxed" title={repository.description}>
            {repository.description}
          </p>
        ) : (
          <span className="text-sm text-muted-foreground/30 italic">无描述</span>
        )}
      </div>

      {/* 主题标签 - 固定高度 */}
      <div className="mb-4 h-6 overflow-hidden">
        {viewOptions.showTopics &&
          repository.topics &&
          repository.topics.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {repository.topics.slice(0, 3).map((topic) => (
                <span
                  key={topic}
                  className="inline-flex items-center rounded-md bg-secondary/40 px-2 py-0.5 text-xs font-medium text-secondary-foreground/80"
                >
                  <Tag className="mr-1 h-3 w-3 opacity-50" />
                  {topic}
                </span>
              ))}
              {repository.topics.length > 3 && (
                <span className="inline-flex items-center rounded-md bg-secondary/40 px-2 py-0.5 text-xs font-medium text-secondary-foreground/80">
                  +{repository.topics.length - 3}
                </span>
              )}
            </div>
          )}
      </div>

      {/* 底部信息 - 左右分栏 */}
      <div className="mt-auto pt-3 border-t border-border/40 flex items-center justify-between gap-2 text-xs text-muted-foreground">

        {/* 左侧：编程语言 */}
        <div className="flex-shrink-0 min-w-0 max-w-[40%]">
          {viewOptions.showLanguage && repository.language ? (
            <div className="flex items-center gap-1.5" title={repository.language}>
              <span
                className="h-2 w-2 rounded-full ring-1 ring-background flex-shrink-0"
                style={{
                  backgroundColor: getLanguageColor(repository.language),
                }}
              />
              <span className="font-medium truncate">{repository.language}</span>
            </div>
          ) : (
            <span>&nbsp;</span>
          )}
        </div>

        {/* 右侧：统计数据 和 日期 */}
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
          {viewOptions.showStats && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-yellow-600/90 dark:text-yellow-400">
                <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="font-medium">{formatNumber(repository.stargazers_count)}</span>
              </div>

              {repository.forks_count > 0 && (
                <div className="flex items-center gap-1 text-blue-600/80 dark:text-blue-400">
                  <GitFork className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span className="font-medium">{formatNumber(repository.forks_count)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 text-muted-foreground/60 pl-1 border-l border-border/50">
            <span className="truncate font-medium px-1">{formatDate(repository.updated_at || "")}</span>
          </div>
        </div>
      </div>
    </>
  );

  if (viewOptions.layout === "list") {
    return (
      <div
        className={`group cursor-pointer rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm p-4 sm:p-5 transition-all duration-300 hover:shadow-lg hover:shadow-gray-200/50 hover:border-gray-300/60 hover:-translate-y-0.5 dark:border-gray-700/60 dark:bg-gray-800/80 dark:hover:shadow-xl dark:hover:shadow-gray-900/20 dark:hover:border-gray-600/60 ${className}`}
        onClick={handleCardClick}
      >
        {cardContent}
      </div>
    );
  }

  // 网格布局
  return (
    <div
      className={`group flex h-full cursor-pointer flex-col rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 ${className}`}
      onClick={handleCardClick}
    >
      <div className="flex-1 p-4 sm:p-5">{cardContent}</div>
    </div>
  );
};

// 使用 React.memo 优化性能，避免不必要的重渲染
export default React.memo(RepositoryCard, (prevProps, nextProps) => {
  // 自定义比较函数，只在关键属性变化时重新渲染
  return (
    prevProps.repository.id === nextProps.repository.id &&
    prevProps.isStarred === nextProps.isStarred &&
    prevProps.loading === nextProps.loading &&
    prevProps.viewOptions === nextProps.viewOptions
  );
});
