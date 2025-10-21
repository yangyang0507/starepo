/**
 * 应用设置相关类型定义
 */

import type { ThemeMode, Language, LogLevel } from "./common";

/**
 * 应用设置
 */
export interface AppSettings {
  theme: ThemeMode;
  language: Language;
  developerMode: boolean;
  logLevel: LogLevel;
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  updatedAt: string;
}
