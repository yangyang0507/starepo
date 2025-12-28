import type { Middleware, MiddlewareContext } from '@shared/types/ai-middleware';
import { logger } from '@main/utils/logger';

/**
 * 日志中间件
 * 记录请求和响应信息
 */
export class LoggingMiddleware implements Middleware {
  name = 'logging';
  priority = 100;

  async onRequest(
    params: unknown,
    context: MiddlewareContext,
    next: () => Promise<unknown>
  ): Promise<unknown> {
    logger.debug(`[${context.requestId}] Request to ${context.providerId}|${context.modelId}`, {
      timestamp: context.timestamp,
      metadata: context.metadata,
    });

    const startTime = Date.now();
    try {
      const result = await next();
      const duration = Date.now() - startTime;

      logger.debug(`[${context.requestId}] Request completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`[${context.requestId}] Request failed after ${duration}ms:`, error);
      throw error;
    }
  }

  async onError(
    error: Error,
    context: MiddlewareContext,
    next: () => Promise<unknown>
  ): Promise<unknown> {
    logger.error(`[${context.requestId}] Error in middleware chain:`, {
      error: error.message,
      stack: error.stack,
      context,
    });
    return next();
  }
}
