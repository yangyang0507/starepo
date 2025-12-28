import type { Middleware, MiddlewareContext } from '@shared/types/ai-middleware';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * 限流中间件
 * 限制每个 Provider 的请求频率
 */
export class RateLimitMiddleware implements Middleware {
  name = 'rate-limit';
  priority = 10;

  private requestCounts = new Map<string, RateLimitRecord>();

  constructor(
    private maxRequests: number = 60,
    private windowMs: number = 60000 // 1 分钟
  ) {}

  async onRequest(
    params: unknown,
    context: MiddlewareContext,
    next: () => Promise<unknown>
  ): Promise<unknown> {
    const key = context.providerId;
    const now = Date.now();
    const record = this.requestCounts.get(key);

    if (!record || now > record.resetTime) {
      // 创建新的限流记录
      this.requestCounts.set(key, { count: 1, resetTime: now + this.windowMs });
      return next();
    }

    if (record.count >= this.maxRequests) {
      const waitTime = record.resetTime - now;
      throw new Error(
        `Rate limit exceeded for provider ${context.providerId}. Please wait ${Math.ceil(waitTime / 1000)}s`
      );
    }

    record.count++;
    return next();
  }

  /**
   * 重置指定 Provider 的限流计数
   */
  reset(providerId: string): void {
    this.requestCounts.delete(providerId);
  }

  /**
   * 清空所有限流记录
   */
  clear(): void {
    this.requestCounts.clear();
  }

  /**
   * 获取当前限流状态
   */
  getStatus(providerId: string): { count: number; remaining: number; resetTime: number } | null {
    const record = this.requestCounts.get(providerId);
    if (!record) {
      return null;
    }

    return {
      count: record.count,
      remaining: Math.max(0, this.maxRequests - record.count),
      resetTime: record.resetTime,
    };
  }
}
