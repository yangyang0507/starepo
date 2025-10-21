/**
 * 通用类型定义
 * 用于整个应用的基础类型
 */

/**
 * API 响应基础类型
 */
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 应用错误类型
 */
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * 日志级别
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * 语言类型
 */
export type Language = "en" | "zh-CN";

/**
 * 主题模式
 */
export type ThemeMode = "light" | "dark" | "system";
