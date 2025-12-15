/**
 * AI Agent 工具系统类型定义
 * 定义工具接口、参数和返回值类型
 */

import type { GitHubRepository } from '@shared/types';

// ============ 工具基础类型 =============

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, ToolParameter>;
  required?: string[];
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

// ============ 具体工具参数类型 =============

export interface SearchRepositoriesParams {
  query: string;
  limit?: number;
  sortBy?: 'stars' | 'updated' | 'created' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

export interface FilterRepositoriesParams {
  language?: string;
  minStars?: number;
  maxStars?: number;
  dateRange?: {
    field: 'created' | 'updated';
    start?: string; // ISO date string
    end?: string;   // ISO date string
  };
  limit?: number;
  sortBy?: 'stars' | 'updated' | 'created';
  sortOrder?: 'asc' | 'desc';
}

export interface GetRepositoryDetailsParams {
  repositoryId: string;
}

export interface GetPopularRepositoriesParams {
  limit?: number;
  language?: string;
}

export interface GetRepositoriesByTopicParams {
  topic: string;
  limit?: number;
  sortBy?: 'stars' | 'updated' | 'created';
  sortOrder?: 'asc' | 'desc';
}

export interface GetRepositoryStatisticsParams {
  groupBy?: 'language' | 'topic';
  limit?: number;
}

// ============ 工具返回值类型 =============

export interface RepositorySearchResult {
  repositories: GitHubRepository[];
  totalCount: number;
  hasMore: boolean;
}

// RepositoryDetails 就是 GitHubRepository，未来可以扩展
export type RepositoryDetails = GitHubRepository;

export interface RepositoryStatistics {
  totalRepositories: number;
  languageDistribution?: Record<string, number>;
  topicDistribution?: Record<string, number>;
  averageStars?: number;
  totalStars?: number;
}

// ============ 工具执行器接口 =============

export interface ITool {
  readonly definition: ToolDefinition;
  execute(params: Record<string, unknown>): Promise<unknown>;
}

export interface IToolRegistry {
  register(tool: ITool): void;
  get(name: string): ITool | undefined;
  getAll(): ITool[];
  getDefinitions(): ToolDefinition[];
  execute(toolCall: ToolCall): Promise<ToolResult>;
}
