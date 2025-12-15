/**
 * 应用程序常量定义
 */

// AI 模型缓存相关常量
export const AI_MODEL_CACHE_TTL = 3600; // 模型缓存时间（秒）

// AI 服务相关常量
export const AI_MAX_RETRIES = 3; // AI 请求最大重试次数
export const AI_DEFAULT_TIMEOUT = 30000; // AI 请求默认超时时间（毫秒）
export const AI_MAX_TOKENS = 4096; // 默认最大 token 数

// 其他已有的常量...
export * from './ipc-channels';