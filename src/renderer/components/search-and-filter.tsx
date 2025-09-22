import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Search,
  Filter,
  X,
  ChevronDown,
  Star,
  GitFork,
  Code,
  History,
  Flame,
  BarChart,
} from "lucide-react";
import type {
  FilterOptions,
  ViewOptions,
  SearchHistoryItem,
} from "@/services/github/types";
import { getSearchEngine } from "@/services/search";
import type { SearchSuggestion } from "@/services/search/types";
import { SearchAnalytics } from "./search-analytics";

interface SearchAndFilterProps {
  onSearch: (query: string) => void;
  onFilterChange: (filters: Partial<FilterOptions>) => void;
  onViewChange: (view: Partial<ViewOptions>) => void;
  loading?: boolean;
  totalCount?: number;
  className?: string;
}

const LANGUAGES = [
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "Go",
  "Rust",
  "C++",
  "C#",
  "PHP",
  "Ruby",
  "Swift",
  "Kotlin",
  "Dart",
  "Shell",
  "HTML",
  "CSS",
];

const SORT_OPTIONS = [
  { value: "name", label: "名称" },
  { value: "stars", label: "星标数" },
  { value: "updated", label: "更新时间" },
  { value: "created", label: "创建时间" },
];

export const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  onSearch,
  onFilterChange,
  onViewChange,
  loading = false,
  totalCount,
  className = "",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
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
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isSuggestionsVisible, setIsSuggestionsVisible] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isAnalyticsVisible, setIsAnalyticsVisible] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchHistoryItem[]>([]);
  const [popularSearches, setPopularSearches] = useState<SearchSuggestion[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // 搜索防抖
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [suggestionTimeout, setSuggestionTimeout] =
    useState<NodeJS.Timeout | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    const searchEngine = getSearchEngine();
    const results = await searchEngine.suggest(query);
    setSuggestions(results);
    if (results.length > 0) {
      setIsSuggestionsVisible(true);
    }
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);

      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      if (suggestionTimeout) {
        clearTimeout(suggestionTimeout);
      }

      const newSearchTimeout = setTimeout(() => {
        onSearch(value);
      }, 300);

      const newSuggestionTimeout = setTimeout(() => {
        fetchSuggestions(value);
      }, 150); // Shorter delay for suggestions

      setSearchTimeout(newSearchTimeout);
      setSuggestionTimeout(newSuggestionTimeout);
    },
    [onSearch, searchTimeout, suggestionTimeout, fetchSuggestions],
  );

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    handleSearchChange(suggestion.text);
    setIsSuggestionsVisible(false);
    setSuggestions([]);
  };

  const handleHistoryClick = (query: string) => {
    handleSearchChange(query);
    setIsHistoryVisible(false);
  };

  const toggleHistory = async () => {
    if (!isHistoryVisible) {
      const searchEngine = getSearchEngine();
      const [recent, popular] = await Promise.all([
        searchEngine.getSearchHistory(5),
        searchEngine.getPopularSearches(5),
      ]);
      setRecentSearches(recent);
      setPopularSearches(popular);
      setIsAnalyticsVisible(false);
      setIsSuggestionsVisible(false);
    }
    setIsHistoryVisible(!isHistoryVisible);
  };

  const toggleAnalytics = () => {
    if (!isAnalyticsVisible) {
      setIsHistoryVisible(false);
      setIsSuggestionsVisible(false);
    }
    setIsAnalyticsVisible(!isAnalyticsVisible);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSuggestionsVisible(false);
        setIsHistoryVisible(false);
        setIsAnalyticsVisible(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleFilterChange = useCallback(
    (newFilters: Partial<FilterOptions>) => {
      const updatedFilters = { ...filters, ...newFilters };
      setFilters(updatedFilters);
      onFilterChange(updatedFilters);
    },
    [filters, onFilterChange],
  );

  const handleViewChange = useCallback(
    (newView: Partial<ViewOptions>) => {
      const updatedView = { ...viewOptions, ...newView };
      setViewOptions(updatedView);
      onViewChange(updatedView);
    },
    [viewOptions, onViewChange],
  );

  const clearFilters = useCallback(() => {
    const defaultFilters: FilterOptions = {
      sortBy: "updated",
      sortOrder: "desc",
      showArchived: false,
      showForks: true,
    };
    setFilters(defaultFilters);
    onFilterChange(defaultFilters);
  }, [onFilterChange]);

  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      if (suggestionTimeout) {
        clearTimeout(suggestionTimeout);
      }
    };
  }, [searchTimeout, suggestionTimeout]);

  const hasActiveFilters =
    filters.language ||
    filters.topic ||
    filters.minStars !== undefined ||
    filters.maxStars !== undefined;

  return (
    <div
      className={`border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      {/* 搜索栏 */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1" ref={searchContainerRef}>
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
            <input
              type="text"
              placeholder="搜索仓库... 支持高级搜索语法 (如: name:starepo lang:typescript stars:>100)"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => fetchSuggestions(searchQuery)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-20 pl-10 text-gray-900 placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              disabled={loading}
            />
            <div className="absolute top-1/2 right-3 -translate-y-1/2 transform flex items-center gap-2">
              {loading && (
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-500"></div>
              )}
              <button
                onClick={toggleHistory}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="搜索历史"
              >
                <History className="h-4 w-4" />
              </button>
              <button
                onClick={toggleAnalytics}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="搜索分析"
              >
                <BarChart className="h-4 w-4" />
              </button>
            </div>
            {isSuggestionsVisible && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700">
                <ul className="py-1">
                  {suggestions.map((suggestion, index) => (
                    <li
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
                    >
                      <History className="h-4 w-4 text-gray-400" />
                      <span>{suggestion.text}</span>
                      <span className="ml-auto text-xs text-gray-400">
                        {suggestion.type}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {isHistoryVisible && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700">
                <div className="p-4 space-y-4">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      <History className="h-4 w-4" />
                      最近搜索
                    </h3>
                    {recentSearches.length > 0 ? (
                      <ul className="space-y-1">
                        {recentSearches.map((item) => (
                          <li
                            key={item.id}
                            onClick={() => handleHistoryClick(item.query)}
                            className="cursor-pointer text-sm text-gray-600 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400"
                          >
                            {item.query}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">暂无最近搜索记录</p>
                    )}
                  </div>
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                      <Flame className="h-4 w-4 text-orange-500" />
                      热门搜索
                    </h3>
                    {popularSearches.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {popularSearches.map((item) => (
                          <button
                            key={item.text}
                            onClick={() => handleHistoryClick(item.text)}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                          >
                            {item.text}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">暂无热门搜索记录</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            {isAnalyticsVisible && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-700 sm:w-96">
                <SearchAnalytics />
              </div>
            )}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 transition-colors ${
              showFilters || hasActiveFilters
                ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            <Filter className="h-4 w-4" />
            <span>筛选</span>
            {hasActiveFilters && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
                {[
                  filters.language,
                  filters.topic,
                  filters.minStars,
                  filters.maxStars,
                ].filter(Boolean).length}
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
            />
          </button>

          {/* 视图切换 */}
          <div className="flex overflow-hidden rounded-lg border border-gray-300 dark:border-gray-600">
            <button
              onClick={() => handleViewChange({ layout: "grid" })}
              className={`px-3 py-2 text-sm transition-colors ${
                viewOptions.layout === "grid"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              网格
            </button>
            <button
              onClick={() => handleViewChange({ layout: "list" })}
              className={`border-l border-gray-300 px-3 py-2 text-sm transition-colors dark:border-gray-600 ${
                viewOptions.layout === "list"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              列表
            </button>
          </div>
        </div>

        {/* 结果统计 */}
        {totalCount !== undefined && (
          <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            找到 {totalCount.toLocaleString()} 个仓库
          </div>
        )}
      </div>

      {/* 筛选面板 */}
      {showFilters && (
        <div className="border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
          <div className="flex justify-end mb-4">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
                清除筛选
              </button>
            )}
          </div>

          <div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* 编程语言 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Code className="mr-1 inline h-4 w-4" />
                  编程语言
                </label>
                <select
                  value={filters.language || ""}
                  onChange={(e) =>
                    handleFilterChange({ language: e.target.value || undefined })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">所有语言</option>
                  {LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              {/* 主题 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  主题
                </label>
                <input
                  type="text"
                  placeholder="输入主题..."
                  value={filters.topic || ""}
                  onChange={(e) =>
                    handleFilterChange({ topic: e.target.value || undefined })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                />
              </div>

              {/* 星标数范围 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Star className="mr-1 inline h-4 w-4" />
                  星标数
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="最小"
                    value={filters.minStars || ""}
                    onChange={(e) =>
                      handleFilterChange({
                        minStars: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-2 text-gray-900 placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                  />
                  <input
                    type="number"
                    placeholder="最大"
                    value={filters.maxStars || ""}
                    onChange={(e) =>
                      handleFilterChange({
                        maxStars: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-2 text-gray-900 placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                  />
                </div>
              </div>

              {/* 排序 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  排序方式
                </label>
                <div className="flex gap-2">
                  <select
                    value={filters.sortBy || "updated"}
                    onChange={(e) =>
                      handleFilterChange({
                        sortBy: e.target.value as FilterOptions["sortBy"],
                      })
                    }
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filters.sortOrder || "desc"}
                    onChange={(e) =>
                      handleFilterChange({
                        sortOrder: e.target.value as "asc" | "desc",
                      })
                    }
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="desc">降序</option>
                    <option value="asc">升序</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 选项开关 */}
            <div className="mt-4 flex flex-wrap gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.showArchived || false}
                  onChange={(e) =>
                    handleFilterChange({ showArchived: e.target.checked })
                  }
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  显示已归档
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.showForks !== false}
                  onChange={(e) =>
                    handleFilterChange({ showForks: e.target.checked })
                  }
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  <GitFork className="mr-1 inline h-4 w-4" />
                  显示Fork
                </span>
              </label>
            </div>
          </div>

          {/* 视图选项 */}
          <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-600">
            <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
              显示选项
            </h4>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={viewOptions.showDescription}
                  onChange={(e) =>
                    handleViewChange({ showDescription: e.target.checked })
                  }
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  描述
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={viewOptions.showLanguage}
                  onChange={(e) =>
                    handleViewChange({ showLanguage: e.target.checked })
                  }
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  语言
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={viewOptions.showStats}
                  onChange={(e) =>
                    handleViewChange({ showStats: e.target.checked })
                  }
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  统计
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={viewOptions.showTopics}
                  onChange={(e) =>
                    handleViewChange({ showTopics: e.target.checked })
                  }
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  主题
                </span>
              </label>
            </div>

            <div className="mt-3">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                每页显示: {viewOptions.itemsPerPage} 个
              </label>
              <input
                type="range"
                min="10"
                max="100"
                step="10"
                value={viewOptions.itemsPerPage}
                onChange={(e) =>
                  handleViewChange({ itemsPerPage: parseInt(e.target.value) })
                }
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchAndFilter;
