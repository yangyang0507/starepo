import type { GitHubError } from '@shared/types';

/**
 * 检查一个值是否为 Error 对象
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * 从未知错误对象中提取错误信息
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return '未知错误';
}

/**
 * 检查是否为 API 响应错误
 */
export function isAPIError(error: unknown): error is { response: { status: number; data: Record<string, unknown> } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as Record<string, unknown>).response === 'object' &&
    (error as Record<string, unknown>).response !== null &&
    'status' in ((error as Record<string, unknown>).response as Record<string, unknown>)
  );
}

/**
 * 统一的错误处理工具类
 */
export class ErrorHandler {
  /**
   * 处理错误并返回标准化的 GitHubError
   */
  static handle(error: unknown, context: string): GitHubError {
    console.error(`[${context}]`, error);

    if (isAPIError(error)) {
      return this.handleAPIError(error, context);
    }

    const message = getErrorMessage(error);
    return {
      message: `${context}: ${message}`,
    };
  }

  /**
   * 处理 API 错误
   */
  private static handleAPIError(
    error: { response: { status: number; data: Record<string, unknown> } },
    context: string
  ): GitHubError {
    const { response } = error;
    const errorData = response.data || {};

    return {
      message: `${context}: ${(errorData.message as string) || getErrorMessage(error)}`,
      status: response.status,
      code: Array.isArray(errorData.errors) && errorData.errors[0] ?
        (errorData.errors[0] as Record<string, unknown>).code as string : undefined,
      documentation_url: errorData.documentation_url as string,
    };
  }

  /**
   * 检查是否为网络错误
   */
  static isNetworkError(error: unknown): boolean {
    if (isError(error)) {
      return (
        error.message.includes('Network') ||
        error.message.includes('fetch') ||
        error.message.includes('ECONNREFUSED')
      );
    }
    return false;
  }

  /**
   * 检查是否为速率限制错误
   */
  static isRateLimitError(error: unknown): boolean {
    if (isAPIError(error)) {
      return error.response.status === 403 &&
        (typeof error.response.data.message === 'string' && error.response.data.message.includes('rate limit'));
    }
    if (isError(error)) {
      return error.message.includes('rate limit');
    }
    return false;
  }

  /**
   * 检查是否为认证错误
   */
  static isAuthError(error: unknown): boolean {
    if (isAPIError(error)) {
      return error.response.status === 401;
    }
    return false;
  }
}