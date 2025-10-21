/**
 * UI 相关类型定义
 * 包含过滤器、视图选项等前端展示相关类型
 */

/**
 * 过滤器选项
 */
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

/**
 * 视图选项
 */
export interface ViewOptions {
  layout: "grid" | "list";
  itemsPerPage: number;
  showDescription: boolean;
  showLanguage: boolean;
  showStats: boolean;
  showTopics: boolean;
}

/**
 * 认证步骤(用于 UI 流程)
 */
export type AuthStep = "selector" | "token" | "success";
