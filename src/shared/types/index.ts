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
