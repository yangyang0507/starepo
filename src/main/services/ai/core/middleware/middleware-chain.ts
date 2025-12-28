import type { Middleware, MiddlewareContext } from '@shared/types/ai-middleware';

/**
 * 中间件链管理器
 * 负责注册、管理和执行中间件
 */
export class MiddlewareChain {
  private requestMiddlewares: Middleware[] = [];
  private responseMiddlewares: Middleware[] = [];
  private errorMiddlewares: Middleware[] = [];

  /**
   * 注册中间件
   */
  use(middleware: Middleware): this {
    if (middleware.enabled === false) return this;

    if (middleware.onRequest) {
      this.requestMiddlewares.push(middleware);
      this.requestMiddlewares.sort((a, b) => a.priority - b.priority);
    }

    if (middleware.onResponse) {
      this.responseMiddlewares.push(middleware);
      this.responseMiddlewares.sort((a, b) => a.priority - b.priority);
    }

    if (middleware.onError) {
      this.errorMiddlewares.push(middleware);
      this.errorMiddlewares.sort((a, b) => a.priority - b.priority);
    }

    return this;
  }

  /**
   * 执行请求中间件链
   */
  async executeRequest(
    params: unknown,
    context: MiddlewareContext,
    finalHandler: () => Promise<unknown>
  ): Promise<unknown> {
    let index = 0;

    const next = async (): Promise<unknown> => {
      if (index >= this.requestMiddlewares.length) {
        return finalHandler();
      }

      const middleware = this.requestMiddlewares[index++];
      if (middleware.onRequest) {
        return middleware.onRequest(params as Parameters<typeof middleware.onRequest>[0], context, next);
      }
      return next();
    };

    try {
      return await next();
    } catch (error) {
      return this.executeError(error as Error, context);
    }
  }

  /**
   * 执行响应中间件链
   */
  async executeResponse(response: unknown, context: MiddlewareContext): Promise<unknown> {
    let index = 0;
    let currentResponse = response;

    const next = async (): Promise<unknown> => {
      if (index >= this.responseMiddlewares.length) {
        return currentResponse;
      }

      const middleware = this.responseMiddlewares[index++];
      if (middleware.onResponse) {
        currentResponse = await middleware.onResponse(currentResponse, context, next);
      }
      return next();
    };

    return next();
  }

  /**
   * 执行错误中间件链
   */
  async executeError(error: Error, context: MiddlewareContext): Promise<unknown> {
    let index = 0;

    const next = async (): Promise<unknown> => {
      if (index >= this.errorMiddlewares.length) {
        throw error;
      }

      const middleware = this.errorMiddlewares[index++];
      if (middleware.onError) {
        return middleware.onError(error, context, next);
      }
      return next();
    };

    return next();
  }

  /**
   * 移除中间件
   */
  remove(name: string): boolean {
    const removeFrom = (arr: Middleware[]) => {
      const index = arr.findIndex((m) => m.name === name);
      if (index !== -1) {
        arr.splice(index, 1);
        return true;
      }
      return false;
    };

    return (
      removeFrom(this.requestMiddlewares) ||
      removeFrom(this.responseMiddlewares) ||
      removeFrom(this.errorMiddlewares)
    );
  }

  /**
   * 清空所有中间件
   */
  clear(): void {
    this.requestMiddlewares = [];
    this.responseMiddlewares = [];
    this.errorMiddlewares = [];
  }

  /**
   * 获取已注册的中间件数量
   */
  get size(): { request: number; response: number; error: number } {
    return {
      request: this.requestMiddlewares.length,
      response: this.responseMiddlewares.length,
      error: this.errorMiddlewares.length,
    };
  }
}
