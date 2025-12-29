/**
 * AI Provider 配置系统
 * 支持多种协议和厂商的灵活配置
 */

import { z } from 'zod';

// =============================================================================
// 1. 基础类型定义
// =============================================================================

/**
 * AI 协议类型
 */
export const AI_PROTOCOL = {
  OPENAI_COMPATIBLE: 'openai_compatible',
  ANTHROPIC: 'anthropic',
} as const;

export type AIProtocol = (typeof AI_PROTOCOL)[keyof typeof AI_PROTOCOL];

/**
 * Provider ID（品牌标识）
 */
export const AI_PROVIDER_ID = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  DEEPSEEK: 'deepseek',
} as const;

export type AIProviderId = (typeof AI_PROVIDER_ID)[keyof typeof AI_PROVIDER_ID];

/**
 * Provider 能力标志
 */
export const PROVIDER_CAPABILITIES = {
  CHAT: 'chat',
  STREAMING: 'streaming',
  TOOLS: 'tools',
  JSON_MODE: 'json_mode',
  VISION: 'vision',
  MODEL_LISTING: 'model_listing',
  SYSTEM_PROMPT: 'system_prompt',
  TEMPERATURE: 'temperature',
  TOP_P: 'top_p',
  MAX_TOKENS: 'max_tokens',
} as const;

export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[keyof typeof PROVIDER_CAPABILITIES];

/**
 * 认证方式
 */
export const AUTH_TYPES = {
  BEARER_TOKEN: 'bearer_token',
  API_KEY_HEADER: 'api_key_header',
  CUSTOM_HEADER: 'custom_header',
  NO_AUTH: 'no_auth',
} as const;

export type AuthType = (typeof AUTH_TYPES)[keyof typeof AUTH_TYPES];

// =============================================================================
// 2. Provider 定义（静态配置）
// =============================================================================

/**
 * Provider 显示信息
 */
export const ProviderDisplaySchema = z.object({
  name: z.string(),
  description: z.string(),
  icon: z.string().optional(), // 图标名称或 URL
  website: z.string().url().optional(),
  docsUrl: z.string().url().optional(),
});

/**
 * Provider 定义（静态配置）
 */
export const ProviderDefinitionSchema = z.object({
  id: z.nativeEnum(AI_PROVIDER_ID),
  protocol: z.nativeEnum(AI_PROTOCOL),
  display: ProviderDisplaySchema,
  capabilities: z.array(z.nativeEnum(PROVIDER_CAPABILITIES)),
  auth: z.object({
    type: z.nativeEnum(AUTH_TYPES),
    keyHeader: z.string().optional(),
    customHeaders: z.record(z.string()).optional(),
  }),
  defaults: z.object({
    baseUrl: z.string().url().optional(),
    models: z.array(z.string()).optional(), // 默认模型列表（兜底用）
    recommendedModel: z.string().optional(),
    maxTokens: z.number().optional(),
    temperature: z.number().optional(),
  }),
  validation: z.object({
    baseUrlRequired: z.boolean().default(false),
    apiKeyRequired: z.boolean().default(true),
    supportsModelListing: z.boolean().default(false),
    modelValidation: z.enum(['strict', 'lenient', 'none']).default('lenient'),
  }),
  healthCheck: z.object({
    endpoint: z.string().optional(),
    method: z.enum(['GET', 'POST']).default('GET'),
    headers: z.record(z.string()).optional(),
    expectedStatus: z.number().default(200),
  }).optional(),
});

export type ProviderDefinition = z.infer<typeof ProviderDefinitionSchema>;

// =============================================================================
// 3. 用户配置
// =============================================================================

/**
 * Provider 账户配置
 */
export const ProviderAccountConfigSchema = z.object({
  providerId: z.nativeEnum(AI_PROVIDER_ID),
  protocol: z.nativeEnum(AI_PROTOCOL).optional(), // 允许覆盖 Provider 的默认协议
  name: z.string().optional(), // 用户自定义的配置名称
  logo: z.string().optional(), // 自定义 Provider 的 Logo（Base64）
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  customHeaders: z.record(z.string()).optional(),
  timeout: z.number().min(1000).max(300000).default(30000), // 超时时间（毫秒）
  retries: z.number().min(0).max(10).default(3), // 重试次数
  proxy: z.object({
    enabled: z.boolean().default(false),
    host: z.string().optional(),
    port: z.number().optional(),
    protocol: z.enum(['http', 'https', 'socks5']).default('http'),
  }).optional(),
  strictTLS: z.boolean().default(true), // 是否严格验证 TLS 证书
  defaultModel: z.string().optional(),
  enabled: z.boolean().default(true),
});

export type ProviderAccountConfig = z.infer<typeof ProviderAccountConfigSchema>;

// =============================================================================
// 4. 模型定义
// =============================================================================

/**
 * 模型能力
 */
export const ModelCapabilitiesSchema = z.object({
  maxTokens: z.number().optional(),
  maxInputTokens: z.number().optional(),
  maxOutputTokens: z.number().optional(),
  supportsStreaming: z.boolean().default(true),
  supportsTools: z.boolean().default(false),
  supportsJsonMode: z.boolean().default(false),
  supportsVision: z.boolean().default(false),
  supportsSystemPrompt: z.boolean().default(true),
  inputPricePerMillion: z.number().optional(),
  outputPricePerMillion: z.number().optional(),
});

export type ModelCapabilities = z.infer<typeof ModelCapabilitiesSchema>;

/**
 * AI 模型信息
 */
export const AIModelSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  providerId: z.nativeEnum(AI_PROVIDER_ID),
  capabilities: ModelCapabilitiesSchema.optional(),
  tags: z.array(z.string()).optional(), // e.g., ['recommended', 'beta', 'legacy']
  deprecated: z.boolean().default(false),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type AIModel = z.infer<typeof AIModelSchema>;

/**
 * 模型列表响应
 */
export const ModelListResponseSchema = z.object({
  models: z.array(AIModelSchema),
  providerId: z.nativeEnum(AI_PROVIDER_ID),
  fetchedAt: z.string().datetime(),
  ttl: z.number().default(3600), // 缓存时间（秒）
  etag: z.string().optional(),
  lastModified: z.string().optional(),
});

export type ModelListResponse = z.infer<typeof ModelListResponseSchema>;

// =============================================================================
// 5. UI 相关类型
// =============================================================================

/**
 * Provider 选择选项
 */
export interface ProviderOption {
  value: AIProviderId;
  label: string;
  description: string;
  icon?: string; // 保留用于向后兼容
  iconId?: string; // 新增：@lobehub/icons 的图标 ID
  isNew?: boolean;
}

/**
 * 模型选择状态
 */
export type ModelSelectionState =
  | 'idle' // 初始状态
  | 'loading' // 正在加载
  | 'success' // 加载成功
  | 'error' // 加载失败
  | 'cached'; // 使用缓存

/**
 * 连接测试结果
 */
export interface ConnectionTestResult {
  success: boolean;
  providerId: AIProviderId;
  message: string;
  details?: {
    latency?: number;
    modelCount?: number;
    recommendedModel?: string;
    warnings?: string[];
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// =============================================================================
// 6. 系统配置
// =============================================================================

/**
 * AI Provider 系统配置
 */
export interface AIProviderSystemConfig {
  providers: ProviderDefinition[];
  defaultProvider: AIProviderId;
  globalSettings: {
    allowInsecureConnections: boolean;
    allowedHosts: string[]; // 允许的主机白名单
    maxRetries: number;
    defaultTimeout: number;
    enableTelemetry: boolean;
  };
}

// =============================================================================
// 7. 迁移相关
// =============================================================================

/**
 * 旧版 AI 设置（用于迁移）
 */
export interface LegacyAISettings {
  provider: string; // 旧的 provider 字段
  model: string;
  apiKey?: string;
  baseURL?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  enabled?: boolean;
}

/**
 * 迁移结果
 */
export interface MigrationResult {
  success: boolean;
  warnings?: string[];
  migratedProviderId?: AIProviderId;
  migratedModel?: string;
}