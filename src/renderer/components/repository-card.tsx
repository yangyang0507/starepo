import React, { useState, useCallback } from "react";
import {
  Star,
  GitFork,
  Eye,
  Calendar,
  ExternalLink,
  Archive,
  Lock,
  Code,
  Tag,
} from "lucide-react";
import type { GitHubRepository, ViewOptions } from "@/services/github/types";

interface RepositoryCardProps {
  repository: GitHubRepository;
  viewOptions: ViewOptions;
  onStar?: (repo: GitHubRepository) => Promise<void>;
  onUnstar?: (repo: GitHubRepository) => Promise<void>;
  isStarred?: boolean;
  loading?: boolean;
  className?: string;
}

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

export const RepositoryCard: React.FC<RepositoryCardProps> = ({
  repository,
  viewOptions,
  onStar,
  onUnstar,
  isStarred = false,
  loading = false,
  className = "",
}) => {
  const [isStarring, setIsStarring] = useState(false);

  const handleStarToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (isStarring || loading) return;

      setIsStarring(true);
      try {
        if (isStarred && onUnstar) {
          await onUnstar(repository);
        } else if (!isStarred && onStar) {
          await onStar(repository);
        }
      } catch (error) {
        console.error("Star operation failed:", error);
      } finally {
        setIsStarring(false);
      }
    },
    [isStarred, isStarring, loading, onStar, onUnstar, repository],
  );

  const handleCardClick = useCallback(() => {
    window.open(repository.html_url, "_blank");
  }, [repository.html_url]);

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
            className={`flex items-center gap-1 rounded-lg px-2 py-1 sm:px-3 sm:py-1.5 text-xs sm:text-sm font-medium transition-all duration-200 ${
              isStarred
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

      {/* 描述 */}
      {viewOptions.showDescription && repository.description && (
        <p className="mb-3 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
          {repository.description}
        </p>
      )}

      {/* 主题标签 */}
      {viewOptions.showTopics &&
        repository.topics &&
        repository.topics.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {repository.topics.slice(0, 5).map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-200/50 transition-all duration-200 hover:from-blue-100 hover:to-indigo-100 hover:ring-blue-300/50 dark:from-blue-900/20 dark:to-indigo-900/20 dark:text-blue-300 dark:ring-blue-700/30 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30"
              >
                <Tag className="mr-1 h-3 w-3" />
                {topic}
              </span>
            ))}
            {repository.topics.length > 5 && (
              <span className="inline-flex items-center rounded-full bg-gradient-to-r from-gray-50 to-slate-50 px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-gray-200/50 dark:from-gray-800/50 dark:to-slate-800/50 dark:text-gray-400 dark:ring-gray-600/30">
                +{repository.topics.length - 5}
              </span>
            )}
          </div>
        )}

      {/* 底部信息 */}
      <div className="flex flex-col gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {/* 编程语言 */}
          {viewOptions.showLanguage && repository.language && (
            <div className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 sm:h-3 sm:w-3 rounded-full ring-1 ring-white/20 shadow-sm"
                style={{
                  backgroundColor: getLanguageColor(repository.language),
                }}
              />
              <span className="truncate font-medium">{repository.language}</span>
            </div>
          )}

          {/* 统计信息 */}
          {viewOptions.showStats && (
            <>
              <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <Star className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="font-medium">{formatNumber(repository.stargazers_count)}</span>
              </div>

              {repository.forks_count > 0 && (
                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <GitFork className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="font-medium">{formatNumber(repository.forks_count)}</span>
                </div>
              )}

              {repository.watchers_count > 0 && (
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="font-medium">{formatNumber(repository.watchers_count)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* 更新时间 */}
        <div className="flex items-center gap-1 flex-shrink-0 text-gray-600 dark:text-gray-400">
          <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
          <span className="truncate font-medium">{formatDate(repository.updated_at)}</span>
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
      className={`group flex h-full cursor-pointer flex-col rounded-xl border border-gray-200/60 bg-white/80 backdrop-blur-sm p-4 sm:p-5 transition-all duration-300 hover:shadow-lg hover:shadow-gray-200/50 hover:border-gray-300/60 hover:-translate-y-0.5 dark:border-gray-700/60 dark:bg-gray-800/80 dark:hover:shadow-xl dark:hover:shadow-gray-900/20 dark:hover:border-gray-600/60 ${className}`}
      onClick={handleCardClick}
    >
      <div className="flex-1">{cardContent}</div>
    </div>
  );
};

export default RepositoryCard;
