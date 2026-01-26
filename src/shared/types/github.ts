/**
 * GitHub 相关类型定义
 * 包含实体模型、API 选项、错误类型等
 */

/**
 * GitHub 用户信息
 */
export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  html_url: string;
  avatar_url: string;
  email: string | null;
  bio?: string | null;
  blog?: string | null;
  company?: string | null;
  location?: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

/**
 * GitHub 仓库所有者信息(精简版)
 */
export interface GitHubRepositoryOwner {
  id: number;
  login: string;
  avatar_url: string;
}

/**
 * GitHub 许可证信息
 */
export interface GitHubLicense {
  key: string;
  name: string;
  spdx_id: string;
  url: string;
}

/**
 * GitHub 仓库信息(完整版)
 */
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string | null;
  updated_at: string | null;
  pushed_at: string;
  size: number;
  default_branch: string;
  topics: string[];
  archived: boolean;
  disabled: boolean;
  private: boolean;
  fork: boolean;
  owner: GitHubRepositoryOwner;
  license?: GitHubLicense;
  /** 用户 star 该仓库的时间（ISO 8601 格式） */
  starred_at?: string;
}

/**
 * GitHub 仓库信息(精简版)
 * 用于列表展示和搜索结果
 */
export interface GitHubRepositorySimple {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  topics: string[];
  updated_at: string;
  created_at: string;
}

/**
 * GitHub 错误信息
 */
export interface GitHubError {
  message: string;
  status?: number;
  code?: string;
  documentation_url?: string;
}

// ============================================================
// GitHub API 选项和参数类型
// ============================================================

/**
 * GitHub API 分页选项
 */
export interface GitHubPaginationOptions {
  sort?: "created" | "updated";
  direction?: "asc" | "desc";
  per_page?: number;
  page?: number;
  // 内部使用:进度回调和分批处理选项
  onProgress?: (loaded: number, total?: number) => void;
  batchSize?: number;
  forceRefresh?: boolean;
  useDatabase?: boolean;
}

/**
 * GitHub API 搜索选项
 */
export interface GitHubSearchOptions extends Omit<GitHubPaginationOptions, "sort"> {
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
 * 批量操作请求类型
 */
export interface BatchRepositoryOperation {
  owner: string;
  repo: string;
}
