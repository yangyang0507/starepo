// GitHub API 相关类型定义
import type { AuthStep } from '@shared/types';

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  language: string | null;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  default_branch: string;
  topics: string[];
  archived: boolean;
  disabled: boolean;
  private: boolean;
  fork: boolean;
  owner: {
    id: number;
    login: string;
    avatar_url: string;
  };
  license?: {
    key: string;
    name: string;
    spdx_id: string;
    url: string;
  };
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
  html_url: string;
  tarball_url: string;
  zipball_url: string;
  author: {
    id: number;
    login: string;
    avatar_url: string;
  };
}

export interface GitHubLanguageStats {
  [language: string]: number;
}

export interface RateLimitInfo {
  core: {
    limit: number;
    remaining: number;
    reset: Date;
    used: number;
  };
  search: {
    limit: number;
    remaining: number;
    reset: Date;
    used: number;
  };
  graphql: {
    limit: number;
    remaining: number;
    reset: Date;
    used: number;
  };
  lastUpdated: Date;
}

export interface GitHubClientConfig {
  authMethod: "token";
  token?: string;
  baseUrl?: string;
  userAgent?: string;
  timeout?: number;
}

export interface AuthenticationResult {
  success: boolean;
  user?: GitHubUser;
  error?: string;
}

export interface StarredRepository extends GitHubRepository {
  starred_at: string;
}

export interface RepositorySearchResult {
  repositories: GitHubRepository[];
  total_count: number;
  incomplete_results: boolean;
}

export interface SearchFilters {
  language?: string;
  topic?: string;
  stars?: string;
  size?: string;
  created?: string;
  updated?: string;
  pushed?: string;
  license?: string;
  user?: string;
  org?: string;
  in?: string[];
  sort?: "stars" | "forks" | "help-wanted-issues" | "updated";
  order?: "asc" | "desc";
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  useMemory?: boolean;
  useIndexedDB?: boolean;
}

export interface GitHubError {
  message: string;
  status?: number;
  code?: string;
  documentation_url?: string;
}

export interface PaginationInfo {
  page: number;
  per_page: number;
  total_count?: number;
  has_next_page: boolean;
  has_prev_page: boolean;
}

export interface StarOperation {
  type: "star" | "unstar";
  owner: string;
  repo: string;
  timestamp: number;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSync?: Date;
  totalRepositories?: number;
  syncedRepositories?: number;
  errors?: string[];
}


export interface TokenValidationResult {
  valid: boolean;
  user?: GitHubUser;
  scopes?: string[];
  error?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  authMethod?: "token";
  user?: GitHubUser;
  token?: string;
  scopes?: string[];
  expiresAt?: Date;
}

// AuthGuard 状态接口
export interface AuthGuardState {
  authState: AuthState | null;
  isLoading: boolean;
  error: string | null;
  hasCheckedAuth: boolean;
}

// 引导流程状态接口
export interface OnboardingState {
  currentStep: AuthStep;
  completedSteps: AuthStep[];
  canProceed: boolean;
}

export interface RepositoryListItem extends GitHubRepository {
  isStarred: boolean;
  starred_at?: string;
  cached?: boolean;
}

export interface FilterOptions {
  search?: string;
  language?: string;
  topic?: string;
  minStars?: number;
  maxStars?: number;
  sortBy?: "name" | "stars" | "updated" | "created";
  sortOrder?: "asc" | "desc";
  showArchived?: boolean;
  showForks?: boolean;
}

// 搜索和筛选组件专用的筛选选项
export interface SearchFilterOptions {
  sortBy?: "name" | "stars" | "updated" | "created";
  sortOrder?: "asc" | "desc";
  language?: string;
  topic?: string;
  minStars?: number;
  maxStars?: number;
  showArchived?: boolean;
  showForks?: boolean;
}

export interface ViewOptions {
  layout: "grid" | "list";
  itemsPerPage: number;
  showDescription: boolean;
  showLanguage: boolean;
  showStats: boolean;
  showTopics: boolean;
}

// 存储相关类型
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

export interface SecureStorageOptions {
  encrypt?: boolean;
  keyPrefix?: string;
}

// 事件类型
export interface GitHubEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface StarEvent extends GitHubEvent {
  type: "star" | "unstar";
  data: {
    repository: GitHubRepository;
    user: GitHubUser;
  };
}

export interface SyncEvent extends GitHubEvent {
  type: "sync_start" | "sync_progress" | "sync_complete" | "sync_error";
  data: {
    status: SyncStatus;
    error?: string;
  };
}

export interface AuthEvent extends GitHubEvent {
  type: "auth_success" | "auth_error" | "auth_logout";
  data: {
    user?: GitHubUser;
    error?: string;
  };
}

export interface RateLimitEvent extends GitHubEvent {
  type: "rate-limit-updated" | "rate-limit-warning" | "rate-limit-exceeded";
  data: {
    limit: number;
    remaining: number;
    reset: number;
    used: number;
    resource: string;
  };
}

// GitHub API 响应类型
export interface GitHubAPIStarredItem {
  starred_at: string;
  repo: GitHubAPIRepository;
}

export interface GitHubAPIUser {
  id: number;
  login: string;
  name: string | null;
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

export interface GitHubAPIRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  stargazers_count: number;
  language: string | null;
  topics: string[] | undefined;
  updated_at: string;
  created_at: string;
  pushed_at: string;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  size: number;
  default_branch: string;
  archived: boolean;
  disabled: boolean;
  private: boolean;
  fork: boolean;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    type: string;
  };
}