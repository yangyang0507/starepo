/**
 * 预定义的 AI Provider 配置
 * 包含各大厂商的默认配置和能力定义
 */

import {
  AI_PROVIDER_ID,
  AI_PROTOCOL,
  AUTH_TYPES,
  PROVIDER_CAPABILITIES,
  ProviderDefinition,
  AIProviderSystemConfig,
  ProviderCapability,
} from '@shared/types/ai-provider';

// =============================================================================
// 1. OpenAI Provider
// =============================================================================

export const OPENAI_PROVIDER: ProviderDefinition = {
  id: AI_PROVIDER_ID.OPENAI,
  protocol: AI_PROTOCOL.OPENAI_COMPATIBLE,
  display: {
    name: 'OpenAI',
    description: '官方 GPT 系列模型，功能全面',
    icon: 'openai',
    website: 'https://openai.com',
    docsUrl: 'https://platform.openai.com/docs',
  },
  capabilities: [
    PROVIDER_CAPABILITIES.CHAT,
    PROVIDER_CAPABILITIES.STREAMING,
    PROVIDER_CAPABILITIES.TOOLS,
    PROVIDER_CAPABILITIES.JSON_MODE,
    PROVIDER_CAPABILITIES.VISION,
    PROVIDER_CAPABILITIES.MODEL_LISTING,
    PROVIDER_CAPABILITIES.SYSTEM_PROMPT,
    PROVIDER_CAPABILITIES.TEMPERATURE,
    PROVIDER_CAPABILITIES.TOP_P,
    PROVIDER_CAPABILITIES.MAX_TOKENS,
  ],
  auth: {
    type: AUTH_TYPES.BEARER_TOKEN,
    keyHeader: 'Authorization',
  },
  defaults: {
    baseUrl: 'https://api.openai.com/v1',
    models: [
      'gpt-5.2-2025-12-11',
      'gpt-5.1-2025-11-13',
      'gpt-5-2025-08-07',
      'gpt-5-mini-2025-08-07',
      'gpt-5-nano-2025-08-07'
    ],
    recommendedModel: 'gpt-5.2-2025-12-11',
    maxTokens: 4096,
    temperature: 0.7,
  },
  validation: {
    baseUrlRequired: false,
    apiKeyRequired: true,
    supportsModelListing: true,
    modelValidation: 'strict',
  },
  healthCheck: {
    endpoint: '/models',
    method: 'GET',
    headers: {},
    expectedStatus: 200,
  },
};

// =============================================================================
// 2. Anthropic Provider
// =============================================================================

export const ANTHROPIC_PROVIDER: ProviderDefinition = {
  id: AI_PROVIDER_ID.ANTHROPIC,
  protocol: AI_PROTOCOL.ANTHROPIC,
  display: {
    name: 'Anthropic',
    description: 'Claude 系列模型，擅长长文本理解',
    icon: 'anthropic',
    website: 'https://anthropic.com',
    docsUrl: 'https://docs.anthropic.com',
  },
  capabilities: [
    PROVIDER_CAPABILITIES.CHAT,
    PROVIDER_CAPABILITIES.STREAMING,
    PROVIDER_CAPABILITIES.TOOLS,
    PROVIDER_CAPABILITIES.VISION,
    PROVIDER_CAPABILITIES.SYSTEM_PROMPT,
    PROVIDER_CAPABILITIES.TEMPERATURE,
    PROVIDER_CAPABILITIES.TOP_P,
    PROVIDER_CAPABILITIES.MAX_TOKENS,
  ],
  auth: {
    type: AUTH_TYPES.API_KEY_HEADER,
    keyHeader: 'x-api-key',
    customHeaders: {
      'anthropic-version': '2023-06-01',
    },
  },
  defaults: {
    baseUrl: 'https://api.anthropic.com',
    models: [
      'claude-sonnet-4-5-20250929',
      'claude-haiku-4-5-20251001',
      'claude-opus-4-5-20251101'
    ],
    recommendedModel: 'claude-sonnet-4-5-20250929',
    maxTokens: 4096,
    temperature: 0.7,
  },
  validation: {
    baseUrlRequired: false,
    apiKeyRequired: true,
    supportsModelListing: false, // Anthropic 不提供模型列表 API
    modelValidation: 'lenient',
  },
  healthCheck: {
    endpoint: '/messages',
    method: 'POST',
    headers: {},
    expectedStatus: 200,
  },
};

// =============================================================================
// 3. DeepSeek Provider
// =============================================================================

export const DEEPSEEK_PROVIDER: ProviderDefinition = {
  id: AI_PROVIDER_ID.DEEPSEEK,
  protocol: AI_PROTOCOL.OPENAI_COMPATIBLE,
  display: {
    name: 'DeepSeek',
    description: '中国大陆可用的高性价比模型',
    icon: 'deepseek',
    website: 'https://deepseek.com',
    docsUrl: 'https://platform.deepseek.com',
  },
  capabilities: [
    PROVIDER_CAPABILITIES.CHAT,
    PROVIDER_CAPABILITIES.STREAMING,
    PROVIDER_CAPABILITIES.TOOLS,
    PROVIDER_CAPABILITIES.SYSTEM_PROMPT,
    PROVIDER_CAPABILITIES.TEMPERATURE,
    PROVIDER_CAPABILITIES.TOP_P,
    PROVIDER_CAPABILITIES.MAX_TOKENS,
  ],
  auth: {
    type: AUTH_TYPES.BEARER_TOKEN,
    keyHeader: 'Authorization',
  },
  defaults: {
    baseUrl: 'https://api.deepseek.com',
    models: [
      'deepseek-chat',
      'deepseek-reasoner',
    ],
    recommendedModel: 'deepseek-chat',
    maxTokens: 4096,
    temperature: 0.7,
  },
  validation: {
    baseUrlRequired: false,
    apiKeyRequired: true,
    supportsModelListing: false,
    modelValidation: 'lenient',
  },
};

// =============================================================================
// 4. 系统配置
// =============================================================================

export const AI_PROVIDER_SYSTEM_CONFIG: AIProviderSystemConfig = {
  providers: [
    OPENAI_PROVIDER,
    ANTHROPIC_PROVIDER,
    DEEPSEEK_PROVIDER,
  ],
  defaultProvider: AI_PROVIDER_ID.OPENAI,
  globalSettings: {
    allowInsecureConnections: false, // 是否允许 http 连接
    allowedHosts: [], // 空白名单表示允许所有主机
    maxRetries: 3,
    defaultTimeout: 30000,
    enableTelemetry: true,
  },
};

// =============================================================================
// 8. 辅助函数
// =============================================================================

/**
 * 获取 Provider 定义
 */
export function getProviderDefinition(providerId: string): ProviderDefinition | undefined {
  return AI_PROVIDER_SYSTEM_CONFIG.providers.find(p => p.id === providerId);
}

/**
 * 获取所有 Provider 选项（用于 UI 选择）
 */
export function getProviderOptions(): Array<{
  value: string;
  label: string;
  description: string;
  icon?: string;
  isNew?: boolean;
  isBeta?: boolean;
}> {
  return AI_PROVIDER_SYSTEM_CONFIG.providers.map(provider => ({
    value: provider.id,
    label: provider.display.name,
    description: provider.display.description,
    icon: provider.display.icon,
    isNew: false,
  }));
}

/**
 * 检查 Provider 是否支持某个能力
 */
export function hasCapability(
  providerId: string,
  capability: string
): boolean {
  const provider = getProviderDefinition(providerId);
  return provider?.capabilities.includes(capability as ProviderCapability) ?? false;
}