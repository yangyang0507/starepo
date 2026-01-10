/**
 * AI 相关的类型定义
 * 用于 Main Process 和 Renderer Process 之间的通信
 */

// AI 提供商类型
export type AIProvider = 'openai' | 'anthropic' | 'deepseek' | 'ollama';

// 聊天角色
export type ChatRole = 'user' | 'assistant' | 'system';

// 消息部分类型
export type MessagePartType = 'text' | 'tool_call';

// 消息部分基础接口
export interface BaseMessagePart {
  type: MessagePartType;
  id: string; // 唯一标识，用于 React key
}

// 文本部分
export interface TextPart extends BaseMessagePart {
  type: 'text';
  content: string;
}

// 工具调用部分
export interface ToolCallPart extends BaseMessagePart {
  type: 'tool_call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: 'calling' | 'success' | 'error';
  result?: unknown;
  error?: string;
  startedAt?: number;
  endedAt?: number;
}

// 消息部分联合类型
export type MessagePart = TextPart | ToolCallPart;

// 聊天消息
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string; // 保持向后兼容，作为纯文本降级显示
  parts?: MessagePart[]; // 新的结构化数据
  timestamp: number;
  references?: RepositoryReference[];
  error?: string;
}

// 仓库引用信息
export interface RepositoryReference {
  repositoryId: string;
  repositoryName: string;
  owner: string;
  url: string;
  description?: string;
  relevanceScore: number;
  stars?: number;
  language?: string;
}

// AI 配置
export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  apiKey: string; // 通过 IPC 时不发送，只在 Main Process 使用
  model: string;
  baseURL?: string; // 自定义 API 端点（可选）
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

// AI 配置（安全版本，不含 API Key）
export interface AISafeSettings extends Omit<AISettings, 'apiKey'> {
  configured: boolean; // 是否已配置
  lastUpdated?: number;
}

// AI 响应
export interface AIResponse {
  content: string;
  references: RepositoryReference[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

// 向量搜索结果
export interface VectorSearchResult {
  repositories: RepositoryReference[];
  totalTime: number; // 搜索耗时（毫秒）
}

// IPC 请求/响应通用结构
export interface IPCRequest<T = unknown> {
  action: string;
  payload?: T;
  id?: string; // 用于匹配请求和响应
}

export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  id?: string;
}

// AI IPC 事件载荷
export interface AIChatPayload {
  message: string;
  userId?: string;
  conversationId?: string;
}

// 流式聊天载荷
export interface AIChatStreamPayload extends AIChatPayload {
  signalId?: string;
}

// 流式数据块类型
export type StreamChunkType = 'text' | 'tool' | 'error' | 'end';

// 工具调用信息（用于流式传输）
export interface ToolCallInfo {
  id: string; // 唯一标识
  name: string;
  status: 'calling' | 'result' | 'error';
  arguments?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  startedAt?: number;
  endedAt?: number;
}

// 流式数据块
export interface StreamChunk {
  type: StreamChunkType;
  content: string;
  toolCall?: ToolCallInfo;
  error?: string;
  metadata?: {
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    references?: RepositoryReference[];
  };
}

// 流式会话状态（用于主进程管理）
export interface StreamSessionInfo {
  id: string;
  conversationId: string;
  status: 'active' | 'completed' | 'aborted' | 'error';
  startTime: number;
  lastUpdateTime: number;
  controller?: AbortController; // 仅在主进程使用
}

export interface AISettingsPayload {
  provider?: AIProvider;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  apiKey?: string; // 仅用于设置
}

export interface AITestConnectionPayload {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

// 聊天上下文
export interface ChatContext {
  conversationHistory: ChatMessage[];
  searchResults?: VectorSearchResult;
  userId?: string;
  metadata?: Record<string, unknown>;
}

// API 使用统计
export interface APIUsageStats {
  totalCalls: number;
  totalTokens: number;
  thisMonthCalls: number;
  thisMonthTokens: number;
  averageResponseTime: number;
  lastSyncTime: number;
}


// AI 错误类型
export class AIError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode?: number,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AIError';
  }
}

// 已知的 AI 错误代码
export enum AIErrorCode {
  INVALID_API_KEY = 'INVALID_API_KEY',
  RATE_LIMITED = 'RATE_LIMITED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_MODEL = 'INVALID_MODEL',
  SEARCH_FAILED = 'SEARCH_FAILED',
  LLM_ERROR = 'LLM_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  NOT_CONFIGURED = 'NOT_CONFIGURED',
}

// LLM 模型配置
export interface LLMModelConfig {
  provider: AIProvider;
  modelId: string;
  label: string;
  description?: string;
  contextWindow?: number;
  costPerMillion?: {
    input: number;
    output: number;
  };
  recommended?: boolean;
}

// 预定义的模型列表
export const PREDEFINED_MODELS: Record<AIProvider, LLMModelConfig[]> = {
  openai: [
    {
      provider: 'openai',
      modelId: 'gpt-4o',
      label: 'GPT-4 Turbo',
      description: '最强大的模型，适合复杂任务',
      contextWindow: 128000,
      recommended: true,
    },
    {
      provider: 'openai',
      modelId: 'gpt-4-turbo',
      label: 'GPT-4 Turbo',
      description: '强大且经济的选择',
      contextWindow: 128000,
    },
    {
      provider: 'openai',
      modelId: 'gpt-3.5-turbo',
      label: 'GPT-3.5 Turbo',
      description: '快速且成本低',
      contextWindow: 4096,
    },
  ],
  anthropic: [
    {
      provider: 'anthropic',
      modelId: 'claude-3-opus-20250219',
      label: 'Claude 3 Opus',
      description: '最强大的 Claude 模型',
      contextWindow: 200000,
      recommended: true,
    },
    {
      provider: 'anthropic',
      modelId: 'claude-3-sonnet-20250229',
      label: 'Claude 3 Sonnet',
      description: '平衡的选择',
      contextWindow: 200000,
    },
    {
      provider: 'anthropic',
      modelId: 'claude-3-haiku-20250307',
      label: 'Claude 3 Haiku',
      description: '快速且成本低',
      contextWindow: 200000,
    },
  ],
  deepseek: [
    {
      provider: 'deepseek',
      modelId: 'deepseek-chat',
      label: 'DeepSeek Chat',
      description: 'DeepSeek 对话模型',
      contextWindow: 64000,
      recommended: true,
    },
  ],
  ollama: [
    {
      provider: 'ollama',
      modelId: 'llama2',
      label: 'Llama 2',
      description: '本地运行的开源模型',
      contextWindow: 4096,
    },
  ],
};

