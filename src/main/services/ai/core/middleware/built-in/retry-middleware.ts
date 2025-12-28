import type { Middleware, MiddlewareContext } from '@shared/types/ai-middleware';
import { logger } from '@main/utils/logger';

/**
 * 重试中间件
 * 在请求失败时自动重试
 */
export class RetryMiddleware implements Middleware {
  name = 'retry';
  priority = 50;

  constructor(
    private maxRetries: number = 3,
    private retryDelay: number = 1000,
    private retryableErrors: string[] = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', '429', '503']
  ) {}

  async onRequest(
    params: unknown,
    context: MiddlewareContext,
    next: () => Promise<unknown>
  ): Promise<unknown> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await next();
      } catch (error) {
        lastError = error as Error;

        // 检查是否应该重试
        if (attempt < this.maxRetries && this.shouldRetry(error as Error)) {
          const delay = this.calculateDelay(attempt);
          logger.warn(
            `[${context.requestId}] Retry attempt ${attempt + 1}/${this.maxRetries} after ${delay}ms`,
            {
              error: (error as Error).message,
            }
          );
          await this.sleep(delay);
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  private shouldRetry(error: Error): boolean {
    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as any).code || '';

    return this.retryableErrors.some(
      (retryable) =>
        errorMessage.includes(retryable.toLowerCase()) || errorCode === retryable
    );
  }

  private calculateDelay(attempt: number): number {
    // 指数退避：1s, 2s, 4s, 8s...
    return this.retryDelay * Math.pow(2, attempt);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
