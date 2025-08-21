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
      <div className="mb-3 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
              {repository.name}
            </h3>
            {repository.private && (
              <Lock className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            )}
            {repository.archived && (
              <Archive className="h-4 w-4 flex-shrink-0 text-yellow-500" />
            )}
            {repository.fork && (
              <GitFork className="h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            )}
          </div>
          <p className="truncate text-sm text-gray-600 dark:text-gray-400">
            {repository.owner.login}
          </p>
        </div>

        <div className="ml-3 flex items-center gap-2">
          <button
            onClick={handleStarToggle}
            disabled={isStarring || loading}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              isStarred
                ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:hover:bg-yellow-900/30"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            } ${isStarring || loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          >
            <Star className={`h-4 w-4 ${isStarred ? "fill-current" : ""}`} />
            <span>{isStarred ? "Starred" : "Star"}</span>
            {isStarring && (
              <div className="h-3 w-3 animate-spin rounded-full border-b border-current"></div>
            )}
          </button>

          <button
            onClick={handleCardClick}
            className="p-1.5 text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="在GitHub中打开"
          >
            <ExternalLink className="h-4 w-4" />
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
          <div className="mb-3 flex flex-wrap gap-1">
            {repository.topics.slice(0, 5).map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
              >
                <Tag className="mr-1 h-3 w-3" />
                {topic}
              </span>
            ))}
            {repository.topics.length > 5 && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                +{repository.topics.length - 5}
              </span>
            )}
          </div>
        )}

      {/* 底部信息 */}
      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-4">
          {/* 编程语言 */}
          {viewOptions.showLanguage && repository.language && (
            <div className="flex items-center gap-1">
              <div
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor: getLanguageColor(repository.language),
                }}
              />
              <span>{repository.language}</span>
            </div>
          )}

          {/* 统计信息 */}
          {viewOptions.showStats && (
            <>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4" />
                <span>{formatNumber(repository.stargazers_count)}</span>
              </div>

              {repository.forks_count > 0 && (
                <div className="flex items-center gap-1">
                  <GitFork className="h-4 w-4" />
                  <span>{formatNumber(repository.forks_count)}</span>
                </div>
              )}

              {repository.watchers_count > 0 && (
                <div className="flex items-center gap-1">
                  <Eye className="h-4 w-4" />
                  <span>{formatNumber(repository.watchers_count)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* 更新时间 */}
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(repository.updated_at)}</span>
        </div>
      </div>
    </>
  );

  if (viewOptions.layout === "list") {
    return (
      <div
        className={`cursor-pointer rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:shadow-lg ${className}`}
        onClick={handleCardClick}
      >
        {cardContent}
      </div>
    );
  }

  // 网格布局
  return (
    <div
      className={`flex h-full cursor-pointer flex-col rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:shadow-lg ${className}`}
      onClick={handleCardClick}
    >
      <div className="flex-1">{cardContent}</div>
    </div>
  );
};

export default RepositoryCard;
