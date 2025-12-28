/**
 * AI Provider Adapter 基础接口
 * 将 ProviderDefinition + ProviderAccountConfig 适配为 AI SDK 的 LanguageModelV2
 */

import type { LanguageModelV2 } from "@ai-sdk/provider";
import {
  AUTH_TYPES,
  type AIProtocol,
  type ProviderAccountConfig,
  type ProviderDefinition,
} from "@shared/types/ai-provider";

export interface CreateLanguageModelParams {
  provider: ProviderDefinition;
  account: ProviderAccountConfig;
  modelId?: string;
}

export interface BaseAdapter {
  readonly protocol: AIProtocol;
  supports(provider: ProviderDefinition): boolean;
  getDefaultModelId(provider: ProviderDefinition, account: ProviderAccountConfig): string;
  createLanguageModel(params: CreateLanguageModelParams): LanguageModelV2;
}

export function resolveBaseUrl(
  provider: ProviderDefinition,
  account: ProviderAccountConfig
): string {
  const baseUrl = account.baseUrl ?? provider.defaults.baseUrl;
  if (!baseUrl) {
    throw new Error(`No baseUrl configured for provider: ${provider.id}`);
  }
  return baseUrl.replace(/\/+$/, "");
}

export function ensurePathSuffix(baseUrl: string, suffix: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  const normalizedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return normalized.endsWith(normalizedSuffix) ? normalized : `${normalized}${normalizedSuffix}`;
}

export function pickModelId(params: {
  provider: ProviderDefinition;
  account: ProviderAccountConfig;
  requestedModelId?: string;
}): string {
  const { provider, account, requestedModelId } = params;
  const modelId =
    (requestedModelId && requestedModelId.trim()) ||
    (account.defaultModel && account.defaultModel.trim()) ||
    (provider.defaults.recommendedModel && provider.defaults.recommendedModel.trim()) ||
    provider.defaults.models?.[0];

  if (!modelId) {
    throw new Error(`No model configured for provider: ${provider.id}`);
  }

  return modelId;
}

export function resolveAuthHeader(
  provider: ProviderDefinition,
  apiKey?: string
): { name: string; value: string } | null {
  if (!apiKey) {
    return null;
  }

  switch (provider.auth.type) {
    case AUTH_TYPES.BEARER_TOKEN: {
      const headerName = provider.auth.keyHeader ?? "Authorization";
      return { name: headerName, value: `Bearer ${apiKey}` };
    }
    case AUTH_TYPES.API_KEY_HEADER: {
      const headerName = provider.auth.keyHeader ?? "x-api-key";
      return { name: headerName, value: apiKey };
    }
    case AUTH_TYPES.CUSTOM_HEADER: {
      if (!provider.auth.keyHeader) {
        return null;
      }
      return { name: provider.auth.keyHeader, value: apiKey };
    }
    case AUTH_TYPES.NO_AUTH:
    default:
      return null;
  }
}

export function mergeHeaders(params: {
  provider: ProviderDefinition;
  account: ProviderAccountConfig;
  authHeader?: { name: string; value: string } | null;
}): Record<string, string> {
  const { provider, account, authHeader } = params;
  const headers: Record<string, string> = {};

  // 添加 provider 的自定义 headers
  if (provider.auth.customHeaders) {
    Object.entries(provider.auth.customHeaders).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    });
  }

  // 添加 account 的自定义 headers
  if (account.customHeaders) {
    Object.entries(account.customHeaders).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    });
  }

  if (authHeader) {
    headers[authHeader.name] = authHeader.value;
  }

  return headers;
}