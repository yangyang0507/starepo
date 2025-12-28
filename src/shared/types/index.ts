/**
 * 共享类型定义 - 导出聚合
 *
 * 此文件作为类型定义的统一导出入口,按功能模块组织导出
 */

// ============================================================
// 通用类型
// ============================================================
export type {
  APIResponse,
  AppError,
  LogLevel,
  Language,
  ThemeMode,
} from "./common";

// ============================================================
// 应用设置
// ============================================================
export type { AppSettings } from "./app-settings";

// ============================================================
// 窗口管理
// ============================================================
export type { WindowState } from "./window";

// ============================================================
// GitHub 相关(实体 + API)
// ============================================================
export type {
  // GitHub 实体
  GitHubUser,
  GitHubRepositoryOwner,
  GitHubLicense,
  GitHubRepository,
  GitHubRepositorySimple,
  GitHubError,
  // GitHub API 选项
  GitHubPaginationOptions,
  GitHubSearchOptions,
  RepositorySyncFilters,
  BatchRepositoryOperation,
} from "./github";

// ============================================================
// 认证
// ============================================================
export type {
  GitHubUser as AuthGitHubUser, // 重导出以保持兼容性
  AuthState,
  TokenInfo,
  RateLimitInfo,
  TokenValidationResult,
  AuthError,
  AuthStore,
  AuthenticateWithTokenRequest,
  AuthenticateWithTokenResponse,
  GetAuthStateRequest,
  GetAuthStateResponse,
  RefreshAuthRequest,
  RefreshAuthResponse,
  ClearAuthRequest,
  ClearAuthResponse,
  ValidateTokenRequest,
  ValidateTokenResponse,
  AuthErrorCode,
  AuthIpcChannel,
  AuthStateTransition,
  AuthStoreConfig,
  LegacyAuthContextType,
} from "./auth";

export {
  AUTH_IPC_CHANNELS,
  AUTH_ERROR_CODES,
  DEFAULT_AUTH_STORE_CONFIG,
} from "./auth";

// ============================================================
// AI 功能
// ============================================================
export type {
  AIProvider,
  ChatRole,
  ChatMessage,
  RepositoryReference,
  AISettings,
  AISafeSettings,
  AIResponse,
  VectorSearchResult,
  IPCRequest,
  IPCResponse,
  AIChatPayload,
  AISettingsPayload,
  AITestConnectionPayload,
  ChatContext,
  APIUsageStats,
  LLMModelConfig,
} from "./ai";

export { AIError, AIErrorCode, PREDEFINED_MODELS } from "./ai";

// ============================================================
// AI Provider 配置系统
// ============================================================
export type {
  AIProtocol,
  AIProviderId,
  ProviderCapability,
  AuthType,
  ProviderDefinition,
  ProviderAccountConfig,
  AIModel,
  ModelCapabilities,
  ModelListResponse,
  ProviderOption,
  ModelSelectionState,
  ConnectionTestResult,
  AIProviderSystemConfig,
  LegacyAISettings,
  MigrationResult,
} from "./ai-provider";

export {
  AI_PROTOCOL,
  AI_PROVIDER_ID,
  PROVIDER_CAPABILITIES,
  AUTH_TYPES,
} from "./ai-provider";

export type { ProviderAccountMetadata } from "@main/services/ai/storage/provider-account-service";

// ============================================================
// 聊天会话
// ============================================================
export interface ChatConversation {
  id: string;
  title: string;
  messages: import("./ai").ChatMessage[];
  created_at: number;
  updated_at: number;
}

// ============================================================
// 存储
// ============================================================
export type { SecureStorageItem, StorageMetadata } from "./storage";

// ============================================================
// 搜索
// ============================================================
export type { SearchResult, SearchHistoryItem } from "./search";

// ============================================================
// UI 相关
// ============================================================
export type { FilterOptions, ViewOptions, AuthStep } from "./ui";

// ============================================================
// 向后兼容的别名 (Deprecated - 建议使用新的类型名)
// ============================================================

/**
 * @deprecated 使用 GitHubRepositorySimple 替代
 */
export type GitHubRepo = import("./github").GitHubRepositorySimple;

/**
 * @deprecated 使用 GitHubAuthInfo 从 auth 模块导入
 */
export interface GitHubAuthInfo {
  token: string;
  authMethod: "token";
  user: import("./github").GitHubUser;
  scopes?: string[];
  expiresAt?: number;
}
