/**
 * GitHub API 相关的类型定义
 * 统一所有 GitHub 相关的 API 选项和参数类型
 */

/**
 * GitHub API 分页选项
 */
export interface GitHubPaginationOptions {
  sort?: "created" | "updated";
  direction?: "asc" | "desc";
  per_page?: number;
  page?: number;
  // 内部使用：进度回调和分批处理选项
  onProgress?: (loaded: number, total?: number) => void;
  batchSize?: number;
  forceRefresh?: boolean;
  useDatabase?: boolean;
}

/**
 * GitHub API 搜索选项
 */
export interface GitHubSearchOptions extends GitHubPaginationOptions {
  q?: string;
  order?: "asc" | "desc";
  sort?: "stars" | "forks" | "updated";
}

/**
 * 仓库同步过滤器选项
 */
export interface RepositorySyncFilters {
  language?: string;
  topics?: string[];
  minStars?: number;
  maxStars?: number;
}

/**
 * GitHub API 响应类型
 */
export interface GitHubAPIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 批量操作请求类型
 */
export interface BatchRepositoryOperation {
  owner: string;
  repo: string;
}

/**
 * GitHub API 错误响应
 */
export interface GitHubAPIError {
  message: string;
  status?: number;
  code?: string;
  documentation_url?: string;
}
