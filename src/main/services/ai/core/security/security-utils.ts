/**
 * 安全工具模块
 * 提供输入验证、日志脱敏等安全功能
 */

import type { AIProviderId } from '@shared/types/ai-provider';
import { AI_PROVIDER_ID } from '@shared/types/ai-provider';

/**
 * Provider ID 白名单
 */
const VALID_PROVIDER_IDS = new Set<string>([
  AI_PROVIDER_ID.OPENAI,
  AI_PROVIDER_ID.ANTHROPIC,
  AI_PROVIDER_ID.DEEPSEEK,
]);

/**
 * 验证 Provider ID
 */
export function validateProviderId(providerId: string): boolean {
  return VALID_PROVIDER_IDS.has(providerId);
}

/**
 * 清理 Provider ID（防止路径遍历）
 */
export function sanitizeProviderId(providerId: AIProviderId): string {
  if (!validateProviderId(providerId)) {
    throw new Error(`Invalid provider ID: ${providerId}`);
  }
  // 移除特殊字符
  return providerId.replace(/[^a-z0-9_-]/gi, '_');
}

/**
 * Model ID 验证规则
 */
const MODEL_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;
const MAX_MODEL_ID_LENGTH = 128;

/**
 * 验证 Model ID 格式
 */
export function validateModelId(modelId: string): boolean {
  if (!modelId || modelId.length === 0) {
    return false;
  }

  if (modelId.length > MAX_MODEL_ID_LENGTH) {
    return false;
  }

  return MODEL_ID_PATTERN.test(modelId);
}

/**
 * 清理 Model ID
 */
export function sanitizeModelId(modelId: string): string {
  if (!validateModelId(modelId)) {
    throw new Error(`Invalid model ID format: ${modelId}`);
  }
  return modelId;
}

/**
 * 禁止的 HTTP 头
 */
const FORBIDDEN_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'cookie',
  'set-cookie',
  'authorization', // 防止覆盖认证头
]);

/**
 * 敏感 HTTP 头（可能泄露信息）
 */
const SENSITIVE_HEADERS = new Set([
  'x-real-ip',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-client-ip',
  'cf-connecting-ip',
]);

/**
 * 验证自定义 HTTP 头
 */
export function validateCustomHeaders(headers: Record<string, string>): Record<string, string> {
  const validated: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();

    if (FORBIDDEN_HEADERS.has(lowerKey)) {
      console.warn(`[Security] Blocked forbidden header: ${key}`);
      continue;
    }

    if (SENSITIVE_HEADERS.has(lowerKey)) {
      console.warn(`[Security] Blocked sensitive header: ${key}`);
      continue;
    }

    validated[key] = value;
  }

  return validated;
}

/**
 * 日志脱敏工具
 */
export function sanitizeForLog(data: unknown): unknown {
  if (typeof data === 'string') {
    // 脱敏 API Key (sk-xxx, Bearer xxx)
    return data
      .replace(/sk-[a-zA-Z0-9]{48}/g, 'sk-***REDACTED***')
      .replace(/Bearer\s+[a-zA-Z0-9_-]+/gi, 'Bearer ***REDACTED***')
      .replace(/"apiKey"\s*:\s*"[^"]+"/g, '"apiKey":"***REDACTED***"')
      .replace(/"api_key"\s*:\s*"[^"]+"/g, '"api_key":"***REDACTED***"');
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: any = Array.isArray(data) ? [] : {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (['apikey', 'api_key', 'token', 'password', 'secret', 'authorization'].includes(lowerKey)) {
        sanitized[key] = '***REDACTED***';
      } else {
        sanitized[key] = sanitizeForLog(value);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * 验证 URL 格式
 */
export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // 只允许 HTTP 和 HTTPS
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 清理 URL（移除尾部斜杠）
 */
export function sanitizeUrl(url: string): string {
  if (!validateUrl(url)) {
    throw new Error(`Invalid URL format: ${url}`);
  }
  return url.replace(/\/+$/, '');
}

/**
 * 限制对话历史大小
 */
export function limitConversationHistory<T>(history: T[], maxSize: number = 100): T[] {
  if (history.length <= maxSize) {
    return history;
  }
  return history.slice(-maxSize);
}

/**
 * 估算 Token 数量（简单估算）
 */
export function estimateTokens(text: string): number {
  // 简单估算：1 token ≈ 4 字符
  return Math.ceil(text.length / 4);
}

/**
 * 根据 Token 限制截取消息历史
 */
export function limitMessagesByTokens<T extends { content: string }>(
  messages: T[],
  maxTokens: number
): T[] {
  let totalTokens = 0;
  const result: T[] = [];

  // 从最新消息开始，逆序添加
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = estimateTokens(msg.content);

    if (totalTokens + msgTokens > maxTokens) {
      break;
    }

    totalTokens += msgTokens;
    result.unshift(msg);
  }

  return result;
}
