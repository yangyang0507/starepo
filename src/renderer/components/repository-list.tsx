import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import SearchAndFilter from "@/components/search-and-filter";
import RepositoryCard from "@/components/repository-card";
import type {
  GitHubRepository,
  FilterOptions,
  ViewOptions,
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

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  startIndex: number;
  endIndex: number;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterOptions>({
    sortBy: "updated",
    sortOrder: "desc",
    showArchived: false,
    showForks: true,
  });
  const [viewOptions, setViewOptions] = useState<ViewOptions>({
    layout: "grid",
    itemsPerPage: 20,
    showDescription: true,
    showLanguage: true,
    showStats: true,
    showTopics: true,
  });
  const [currentPage, setCurrentPage] = useState(1);

  // 筛选和搜索逻辑
  const filteredRepositories = useMemo(() => {
    let filtered = [...repositories];

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (repo) =>
          repo.name.toLowerCase().includes(query) ||
          repo.description?.toLowerCase().includes(query) ||
          repo.owner.login.toLowerCase().includes(query) ||
          repo.topics?.some((topic) => topic.toLowerCase().includes(query)),
      );
    }

    // 语言过滤
    if (filters.language) {
      filtered = filtered.filter((repo) => repo.language === filters.language);
    }

    // 主题过滤
    if (filters.topic) {
      const topic = filters.topic.toLowerCase();
      filtered = filtered.filter((repo) =>
        repo.topics?.some((t) => t.toLowerCase().includes(topic)),
      );
    }

    // 星标数过滤
    if (filters.minStars !== undefined) {
      filtered = filtered.filter(
        (repo) => repo.stargazers_count >= filters.minStars!,
      );
    }
    if (filters.maxStars !== undefined) {
      filtered = filtered.filter(
        (repo) => repo.stargazers_count <= filters.maxStars!,
      );
    }

    // 归档状态过滤
    if (!filters.showArchived) {
      filtered = filtered.filter((repo) => !repo.archived);
    }

    // Fork状态过滤
    if (!filters.showForks) {
      filtered = filtered.filter((repo) => !repo.fork);
    }

    // 排序
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (filters.sortBy) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "stars":
          aValue = a.stargazers_count;
          bValue = b.stargazers_count;
          break;
        case "created":
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case "updated":
        default:
          aValue = new Date(a.updated_at).getTime();
          bValue = new Date(b.updated_at).getTime();
          break;
      }

      if (filters.sortOrder === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return filtered;
  }, [repositories, searchQuery, filters]);

  // 分页逻辑
  const paginationInfo = useMemo((): PaginationInfo => {
    const totalItems = filteredRepositories.length;
    const totalPages = Math.ceil(totalItems / viewOptions.itemsPerPage);
    const startIndex = (currentPage - 1) * viewOptions.itemsPerPage;
    const endIndex = Math.min(
      startIndex + viewOptions.itemsPerPage,
      totalItems,
    );

    return {
      currentPage,
      totalPages,
      totalItems,
      itemsPerPage: viewOptions.itemsPerPage,
      startIndex,
      endIndex,
    };
  }, [filteredRepositories.length, viewOptions.itemsPerPage, currentPage]);

  const paginatedRepositories = useMemo(() => {
    return filteredRepositories.slice(
      paginationInfo.startIndex,
      paginationInfo.endIndex,
    );
  }, [
    filteredRepositories,
    paginationInfo.startIndex,
    paginationInfo.endIndex,
  ]);

  // 重置分页当筛选条件改变时
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, viewOptions.itemsPerPage]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleFilterChange = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters);
  }, []);

  const handleViewChange = useCallback((newView: ViewOptions) => {
    setViewOptions(newView);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const renderPagination = () => {
    if (paginationInfo.totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(
      paginationInfo.totalPages,
      startPage + maxVisiblePages - 1,
    );

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // 上一页按钮
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

    // 页码按钮
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

    // 下一页按钮
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
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          显示第{" "}
          <span className="font-medium">{paginationInfo.startIndex + 1}</span>{" "}
          到 <span className="font-medium">{paginationInfo.endIndex}</span>{" "}
          项，共{" "}
          <span className="font-medium">{paginationInfo.totalItems}</span> 项
        </div>
        <div className="flex items-center gap-1">{pages}</div>
      </div>
    );
  };

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
      {/* 搜索和筛选 */}
      <SearchAndFilter
        onSearch={handleSearch}
        onFilterChange={handleFilterChange}
        onViewChange={handleViewChange}
        loading={loading}
        totalCount={filteredRepositories.length}
      />

      {/* 内容区域 */}
      <div className="flex-1 p-3 sm:p-6">
        {loading && repositories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">正在加载仓库...</p>
          </div>
        ) : filteredRepositories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 text-6xl">📦</div>
            <h3 className="mb-2 text-lg font-medium">
              {searchQuery ||
              Object.values(filters).some(
                (v) => v !== undefined && v !== false && v !== true,
              )
                ? "未找到匹配的仓库"
                : "暂无仓库"}
            </h3>
            <p className="max-w-md text-center text-muted-foreground">
              {searchQuery ||
              Object.values(filters).some(
                (v) => v !== undefined && v !== false && v !== true,
              )
                ? "尝试调整搜索条件或筛选器"
                : "开始Star一些仓库来构建您的收藏"}
            </p>
          </div>
        ) : (
          <>
            {/* 仓库网格/列表 */}
            <div
              className={`${
                viewOptions.layout === "grid"
                  ? "grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
                  : "space-y-3 sm:space-y-4"
              }`}
            >
              {paginatedRepositories.map((repo) => (
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

            {/* 分页 */}
            {renderPagination()}
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
