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
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
    ],
    recommendedModel: 'gpt-4o',
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
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ],
    recommendedModel: 'claude-3-5-sonnet-20241022',
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
      'deepseek-coder',
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
// 4. Ollama Provider (本地部署)
// =============================================================================

export const OLLAMA_PROVIDER: ProviderDefinition = {
  id: AI_PROVIDER_ID.OLLAMA,
  protocol: AI_PROTOCOL.OLLAMA,
  display: {
    name: 'Ollama',
    description: '本地部署的开源模型，需要先安装 Ollama',
    icon: 'ollama',
    website: 'https://ollama.com',
    docsUrl: 'https://github.com/ollama/ollama',
  },
  capabilities: [
    PROVIDER_CAPABILITIES.CHAT,
    PROVIDER_CAPABILITIES.STREAMING,
    PROVIDER_CAPABILITIES.SYSTEM_PROMPT,
    PROVIDER_CAPABILITIES.TEMPERATURE,
    PROVIDER_CAPABILITIES.TOP_P,
  ],
  auth: {
    type: AUTH_TYPES.NO_AUTH,
  },
  defaults: {
    baseUrl: 'http://localhost:11434',
    models: [
      'llama2',
      'codellama',
      'mistral',
      'vicuna',
    ],
    maxTokens: 2048,
    temperature: 0.7,
  },
  validation: {
    baseUrlRequired: false,
    apiKeyRequired: false,
    supportsModelListing: true,
    modelValidation: 'none',
  },
  healthCheck: {
    endpoint: '/api/tags',
    method: 'GET',
    expectedStatus: 200,
  },
};

// =============================================================================
// 5. 自定义 OpenAI 兼容 Provider
// =============================================================================

export const CUSTOM_OPENAI_PROVIDER: ProviderDefinition = {
  id: AI_PROVIDER_ID.CUSTOM_OPENAI,
  protocol: AI_PROTOCOL.OPENAI_COMPATIBLE,
  display: {
    name: '自定义 OpenAI 兼容',
    description: '任何兼容 OpenAI API 格式的服务',
    icon: 'api',
  },
  capabilities: [
    PROVIDER_CAPABILITIES.CHAT,
    PROVIDER_CAPABILITIES.STREAMING,
    PROVIDER_CAPABILITIES.TOOLS,
    PROVIDER_CAPABILITIES.JSON_MODE,
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
    models: [], // 用户必须手动指定
    maxTokens: 4096,
    temperature: 0.7,
  },
  validation: {
    baseUrlRequired: true,
    apiKeyRequired: false, // 某些本地服务可能不需要
    supportsModelListing: true,
    modelValidation: 'lenient',
  },
  healthCheck: {
    endpoint: '/models',
    method: 'GET',
    expectedStatus: 200,
  },
};

// =============================================================================
// 6. 自定义 Anthropic 兼容 Provider
// =============================================================================

export const CUSTOM_ANTHROPIC_PROVIDER: ProviderDefinition = {
  id: AI_PROVIDER_ID.CUSTOM_ANTHROPIC,
  protocol: AI_PROTOCOL.ANTHROPIC,
  display: {
    name: '自定义 Anthropic 兼容',
    description: '兼容 Anthropic API 格式的代理服务',
    icon: 'api',
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
    models: [], // 用户必须手动指定
    maxTokens: 4096,
    temperature: 0.7,
  },
  validation: {
    baseUrlRequired: true,
    apiKeyRequired: false,
    supportsModelListing: false,
    modelValidation: 'lenient',
  },
  healthCheck: {
    endpoint: '/messages',
    method: 'POST',
    expectedStatus: 200,
  },
};

// =============================================================================
// 7. 系统配置
// =============================================================================

export const AI_PROVIDER_SYSTEM_CONFIG: AIProviderSystemConfig = {
  providers: [
    OPENAI_PROVIDER,
    ANTHROPIC_PROVIDER,
    DEEPSEEK_PROVIDER,
    OLLAMA_PROVIDER,
    CUSTOM_OPENAI_PROVIDER,
    CUSTOM_ANTHROPIC_PROVIDER,
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
  isLocal?: boolean;
}> {
  return AI_PROVIDER_SYSTEM_CONFIG.providers.map(provider => ({
    value: provider.id,
    label: provider.display.name,
    description: provider.display.description,
    icon: provider.display.icon,
    isLocal: provider.id === AI_PROVIDER_ID.OLLAMA,
    isBeta: provider.id === AI_PROVIDER_ID.CUSTOM_OPENAI ||
            provider.id === AI_PROVIDER_ID.CUSTOM_ANTHROPIC,
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
  return provider?.capabilities.includes(capability as keyof typeof PROVIDER_CAPABILITIES) ?? false;
}

/**
 * 获取推荐的 Provider 列表
 */
export function getRecommendedProviders(): ProviderDefinition[] {
  return AI_PROVIDER_SYSTEM_CONFIG.providers.filter(p =>
    p.id !== AI_PROVIDER_ID.CUSTOM_OPENAI &&
    p.id !== AI_PROVIDER_ID.CUSTOM_ANTHROPIC
  );
}