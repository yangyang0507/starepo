import React, { useEffect, useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import type { FilterOptions, ViewOptions } from "@shared/types";

interface SearchAndFilterProps {
  onSearch: (query: string) => void;
  onFilterChange?: (filters: Partial<FilterOptions>) => void;
  onViewChange?: (view: Partial<ViewOptions>) => void;
  loading?: boolean;
  totalCount?: number;
  className?: string;
  placeholder?: string;
}

/**
 * 极简搜索组件，仅保留全文搜索输入框和结果数量展示。
 */
export const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  onSearch,
  loading = false,
  totalCount,
  className = "",
  placeholder = "搜索仓库...",
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useMemo(() => searchQuery.trim(), [searchQuery]);

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(debouncedQuery);
    }, 250);

    return () => clearTimeout(handler);
  }, [debouncedQuery, onSearch]);

  return (
    <div
      className={`border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      <div className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pr-10 pl-10 text-gray-900 placeholder-gray-500 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
              disabled={loading}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute top-1/2 right-3 -translate-y-1/2 transform text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="清除搜索"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {typeof totalCount === "number" && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              找到 {totalCount} 个仓库
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchAndFilter;
