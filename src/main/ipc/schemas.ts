/**
 * IPC 请求参数校验 Schema
 * 使用 Zod 进行运行时类型校验，防止类型欺骗攻击
 */

import { z } from 'zod';
import { AI_PROVIDER_ID } from '@shared/types/ai-provider';

// ========== AI 相关 Schema ==========

/**
 * 聊天请求 Payload Schema
 */
export const AIChatPayloadSchema = z.object({
  message: z.string()
    .min(1, '消息不能为空')
    .max(100000, '消息长度不能超过 100000 字符'),
  conversationId: z.string().optional(),
  userId: z.string().optional(),
});

/**
 * 会话 ID Schema
 */
export const SessionIdSchema = z.string().uuid('无效的会话 ID');

/**
 * Provider ID Schema
 */
export const ProviderIdSchema = z.nativeEnum(AI_PROVIDER_ID, {
  message: '不支持的 Provider',
});

// ProviderAccountConfigSchema 已从 @shared/types/ai-provider 导入，不在此处重复定义

/**
 * 生成标题 Payload Schema
 */
export const GenerateTitlePayloadSchema = z.object({
  conversationId: z.string().min(1),
  firstUserMessage: z.string().min(1).max(10000),
  firstAssistantMessage: z.string().max(50000).optional(),
  tempTitle: z.string().min(1).max(500),
  modelId: z.string().optional(),
});

/**
 * 保存会话元数据 Payload Schema
 */
export const SaveConversationMetaPayloadSchema = z.object({
  conversationId: z.string().min(1),
  tempTitle: z.string().min(1).max(500),
});

/**
 * 会话 ID Schema (用于删除等操作)
 */
export const ConversationIdSchema = z.string().min(1, '会话 ID 不能为空');

// ========== 搜索相关 Schema ==========

/**
 * 搜索选项 Schema
 */
export const SearchRepositoriesOptionsSchema = z.object({
  query: z.string().max(500, '搜索查询过长').optional(),
  language: z.string().max(100).optional(),
  minStars: z.number().int().nonnegative().optional(),
  maxStars: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().nonnegative().default(0),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  sortBy: z.enum(['relevance', 'stars', 'updated', 'created']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  disableCache: z.boolean().optional(),
}).refine(
  (data) => !data.maxStars || !data.minStars || data.maxStars >= data.minStars,
  { message: 'maxStars 必须大于等于 minStars' }
);

/**
 * 搜索建议输入 Schema
 */
export const SearchSuggestionsInputSchema = z.object({
  input: z.string().min(1, '输入不能为空').max(200, '输入过长'),
  limit: z.number().int().min(1).max(50).default(10),
});

/**
 * 热门搜索词限制 Schema
 */
export const PopularSearchTermsLimitSchema = z.number()
  .int()
  .min(1, '限制必须至少为 1')
  .max(100, '限制不能超过 100')
  .default(10);

// ========== 工具函数 ==========

/**
 * 创建统一的校验包装器
 */
export function validateWith<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    return schema.parse(data);
  };
}

/**
 * 创建安全的校验包装器（返回结果而非抛出异常）
 */
export function safeValidateWith<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): { success: true; data: T } | { success: false; error: string } => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return {
        success: false,
        error: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
      };
    }
  };
}
