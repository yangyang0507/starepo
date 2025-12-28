import type { CoreMessage } from 'ai';

/**
 * 中间件上下文
 */
export interface MiddlewareContext {
  providerId: string;
  modelId: string;
  requestId: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

/**
 * 请求中间件
 */
export interface RequestMiddleware {
  name: string;
  priority: number;

  onRequest(
    params: {
      messages: CoreMessage[];
      options: Record<string, unknown>;
    },
    context: MiddlewareContext,
    next: () => Promise<unknown>
  ): Promise<unknown>;
}

/**
 * 响应中间件
 */
export interface ResponseMiddleware {
  name: string;
  priority: number;

  onResponse(
    response: unknown,
    context: MiddlewareContext,
    next: () => Promise<unknown>
  ): Promise<unknown>;
}

/**
 * 错误中间件
 */
export interface ErrorMiddleware {
  name: string;
  priority: number;

  onError(
    error: Error,
    context: MiddlewareContext,
    next: () => Promise<unknown>
  ): Promise<unknown>;
}

/**
 * 统一中间件接口
 */
export interface Middleware
  extends Partial<RequestMiddleware>,
    Partial<ResponseMiddleware>,
    Partial<ErrorMiddleware> {
  name: string;
  priority: number;
  enabled?: boolean;
}
