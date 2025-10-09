/**
 * 认证相关类型定义
 * 基于data-model.md设计文档
 */

// 核心认证状态类型
export interface AuthState {
  isAuthenticated: boolean;
  user?: GitHubUser;
  tokenInfo?: TokenInfo;
  lastValidated?: Date;
  expiresAt?: Date;
}

// GitHub用户信息类型
export interface GitHubUser {
  id: number;
  login: string;
  html_url: string;
  avatar_url: string;
  name: string | null;
  email: string | null;
  bio?: string | null;
  public_repos: number;
  followers: number;
  following: number;
}

// Token信息类型
export interface TokenInfo {
  scopes: string[];
  tokenType: 'personal' | 'app';
  createdAt: Date;
  lastUsed: Date;
  rateLimit?: RateLimitInfo;
}

// 速率限制信息类型
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

// Token验证结果类型
export interface TokenValidationResult {
  valid: boolean;
  user?: GitHubUser;
  scopes?: string[];
  error?: string;
}

// 认证错误类型
export interface AuthError {
  code: string;
  message: string;
  timestamp: Date;
  recoverable: boolean;
  details?: Record<string, any>;
}

// Zustand认证状态存储接口
export interface AuthStore {
  authState: AuthState;
  isLoading: boolean;
  error: AuthError | null;

  // 操作方法
  login: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  clearError: () => void;
  initAuth: () => Promise<void>;

  // 内部状态管理方法
  _setAuthState?: (state: AuthState) => void;
  _setLoading?: (loading: boolean) => void;
  _setError?: (error: AuthError | null) => void;
}

// IPC通信类型定义
export interface AuthenticateWithTokenRequest {
  token: string;
}

export interface AuthenticateWithTokenResponse {
  success: boolean;
  user?: GitHubUser;
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface GetAuthStateRequest {
  // 无参数
}

export interface GetAuthStateResponse {
  authState: AuthState;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface RefreshAuthRequest {
  // 无参数
}

export interface RefreshAuthResponse {
  success: boolean;
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ClearAuthRequest {
  // 无参数
}

export interface ClearAuthResponse {
  success: boolean;
  error?: string;
}

export interface ValidateTokenRequest {
  token?: string; // 可选，不提供则验证当前存储的token
}

export interface ValidateTokenResponse {
  valid: boolean;
  user?: GitHubUser;
  tokenInfo?: TokenInfo;
  error?: string;
}

// IPC通道名称常量
export const AUTH_IPC_CHANNELS = {
  AUTHENTICATE_WITH_TOKEN: 'auth:authenticate-with-token',
  GET_AUTH_STATE: 'auth:get-auth-state',
  REFRESH_AUTH: 'auth:refresh-auth',
  CLEAR_AUTH: 'auth:clear-auth',
  VALIDATE_TOKEN: 'auth:validate-token',

  // 事件通道（主进程向渲染进程推送）
  AUTH_STATE_CHANGED: 'auth:state-changed',
  TOKEN_EXPIRED: 'auth:token-expired',
  AUTH_ERROR: 'auth:error',
} as const;

// 错误代码定义
export const AUTH_ERROR_CODES = {
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  STORAGE_ERROR: 'STORAGE_ERROR',
  GITHUB_API_ERROR: 'GITHUB_API_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

// 类型导出
export type AuthErrorCode = keyof typeof AUTH_ERROR_CODES;
export type AuthIpcChannel = keyof typeof AUTH_IPC_CHANNELS;

// 状态转换类型
export type AuthStateTransition =
  | 'INIT'
  | 'LOGIN_START'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_ERROR'
  | 'LOGOUT_START'
  | 'LOGOUT_COMPLETE'
  | 'REFRESH_START'
  | 'REFRESH_SUCCESS'
  | 'REFRESH_ERROR'
  | 'ERROR_CLEARED';

// Store配置选项
export interface AuthStoreConfig {
  autoRefreshInterval?: number;  // 自动刷新间隔（毫秒）
  refreshThreshold?: number;     // Token过期前多久开始刷新（毫秒）
  maxRetries?: number;           // 最大重试次数
  enableCache?: boolean;         // 是否启用本地缓存
  debug?: boolean;               // 是否启用调试日志
}

// 默认配置
export const DEFAULT_AUTH_STORE_CONFIG: Required<AuthStoreConfig> = {
  autoRefreshInterval: 5 * 60 * 1000, // 5分钟
  refreshThreshold: 10 * 60 * 1000,   // Token过期前10分钟刷新
  maxRetries: 3,
  enableCache: true,
  debug: false,
};

// 兼容性类型（用于从React Context迁移）
export interface LegacyAuthContextType {
  authState: AuthState;
  isLoading: boolean;
  error: string | null;
  login: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  clearError: () => void;
}
