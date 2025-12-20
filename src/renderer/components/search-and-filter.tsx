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
    <div className={`p-1 ${className}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder={placeholder}
            className="w-full h-10 rounded-xl border bg-background/50 backdrop-blur-sm pl-10 pr-10 text-sm ring-offset-background transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-background/80 hover:border-accent-foreground/20"
            disabled={loading}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-3 -translate-y-1/2 transform text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="清除搜索"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {typeof totalCount === "number" && (
          <span className="text-sm font-medium text-muted-foreground px-2">
            共 {totalCount} 个仓库
          </span>
        )}
      </div>
    </div>
  );
};

export default SearchAndFilter;
