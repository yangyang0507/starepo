/**
 * 共享类型定义
 * 主进程和渲染进程都可以使用的类型
 */

// 主题相关类型
export type ThemeMode = "light" | "dark" | "system";

// 语言相关类型
export type Language = "en" | "zh-CN";

// 窗口状态类型
export interface WindowState {
  isMaximized: boolean;
  isFullscreen: boolean;
  isMinimized: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// 应用设置类型
export interface AppSettings {
  theme: ThemeMode;
  language: Language;
  windowState: WindowState;
  autoStart: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;
}

// GitHub 相关类型
export interface GitHubUser {
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

// GitHub 认证相关类型
export interface GitHubAuthInfo {
  token: string;
  authMethod: "token";
  user: GitHubUser;
  scopes?: string[];
  expiresAt?: number;
}

export interface AuthState {
  isAuthenticated: boolean;
  authMethod?: "token";
  user?: GitHubUser;
  token?: string;
  scopes?: string[];
  expiresAt?: Date;
}

// 认证步骤类型
export type AuthStep = "selector" | "token" | "success";


// 安全存储相关类型
export interface SecureStorageItem {
  key: string;
  value: string;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

export interface StorageMetadata {
  version: string;
  createdAt: number;
  lastAccessed: number;
}

export interface GitHubRepo {
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

// 数据库相关类型 (未来功能)
export interface SearchResult {
  repos: GitHubRepo[];
  total: number;
  query: string;
  similarity_scores?: number[];
}

// AI 聊天相关类型 (未来功能)
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  repos?: GitHubRepo[];
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: number;
  updated_at: number;
}

// API 响应类型
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 错误类型
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface GitHubError {
  message: string;
  status?: number;
  code?: string;
  documentation_url?: string;
}

// UI 相关类型
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

export interface ViewOptions {
  layout: "grid" | "list";
  itemsPerPage: number;
  showDescription: boolean;
  showLanguage: boolean;
  showStats: boolean;
  showTopics: boolean;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  resultsCount: number;
}
