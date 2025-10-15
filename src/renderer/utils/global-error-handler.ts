/**
 * 全局错误处理器
 * 统一处理应用中所有未捕获的错误
 */

import { ErrorHandler } from './error-handling';

interface ErrorReport {
  timestamp: string;
  error: string;
  stack?: string;
  componentStack?: string;
  userAgent: string;
  url: string;
  userId?: string;
  version: string;
}

class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  private errorQueue: ErrorReport[] = [];
  private isOnline = navigator.onLine;
  private maxQueueSize = 50;

  private constructor() {
    this.setupErrorHandlers();
    this.setupEventListeners();
  }

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  /**
   * 设置各种错误处理器
   */
  private setupErrorHandlers(): void {
    // 未捕获的 JavaScript 错误
    window.addEventListener('error', this.handleGlobalError.bind(this));

    // 未捕获的 Promise 拒绝
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection.bind(this));

    // React 错误（如果在组件中使用）
    this.setupReactErrorHandling();
  }

  /**
   * 初始化全局错误处理器
   */
  public initialize(): void {
    // 错误处理器已经在构造函数中设置
    console.log('GlobalErrorHandler initialized');
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushErrorQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * 设置 React 错误处理
   */
  private setupReactErrorHandling(): void {
    // React 的错误边界会捕获组件错误
    // 但我们也可以在这里设置一些全局处理
  }

  /**
   * 处理全局错误
   */
  private handleGlobalError(event: ErrorEvent): void {
    const errorReport = this.createErrorReport(
      event.error || new Error(event.message),
      {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }
    );

    this.processError(errorReport);
  }

  /**
   * 处理未捕获的 Promise 拒绝
   */
  private handleUnhandledRejection(event: PromiseRejectionEvent): void {
    let error: Error;

    if (event.reason instanceof Error) {
      error = event.reason;
    } else {
      error = new Error(`Unhandled promise rejection: ${event.reason}`);
    }

    const errorReport = this.createErrorReport(error, {
      type: 'unhandledrejection',
      reason: event.reason,
    });

    this.processError(errorReport);
  }

  /**
   * 创建错误报告
   */
  private createErrorReport(error: Error, context?: Record<string, unknown>): ErrorReport {
    return {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      version: '1.0.0', // 在浏览器环境中使用固定版本
      ...context,
    };
  }

  /**
   * 处理错误
   */
  private processError(errorReport: ErrorReport): void {
    // 记录错误
    console.error('Global error reported:', errorReport);

    // 检查是否为网络错误
    const error = new Error(errorReport.error);
    const isNetworkError = ErrorHandler.isNetworkError(error);
    const isRateLimitError = ErrorHandler.isRateLimitError(error);
    const isAuthError = ErrorHandler.isAuthError(error);

    // 在生产环境中发送到错误监控服务
    if (process.env.NODE_ENV === 'production') {
      this.sendErrorReport(errorReport);
    } else {
      // 开发环境中显示错误详情
      this.showErrorNotification(errorReport, {
        isNetworkError,
        isRateLimitError,
        isAuthError,
      });
    }

    // 如果是网络错误，加入队列等待重试
    if (isNetworkError && !this.isOnline) {
      this.queueError(errorReport);
    }
  }

  /**
   * 发送错误报告
   */
  private async sendErrorReport(errorReport: ErrorReport): Promise<void> {
    try {
      // 这里可以集成 Sentry、LogRocket 等错误监控服务
      // 暂时使用 console.log 作为占位符
      console.log('Error report sent:', errorReport);
      
      // 示例：发送到自定义错误 API
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorReport),
      // });
    } catch (sendError) {
      console.error('Failed to send error report:', sendError);
      this.queueError(errorReport);
    }
  }

  /**
   * 将错误加入队列
   */
  private queueError(errorReport: ErrorReport): void {
    if (this.errorQueue.length >= this.maxQueueSize) {
      this.errorQueue.shift(); // 移除最旧的错误
    }
    this.errorQueue.push(errorReport);
  }

  /**
   * 清空错误队列
   */
  private async flushErrorQueue(): Promise<void> {
    const errors = [...this.errorQueue];
    this.errorQueue = [];

    for (const errorReport of errors) {
      try {
        await this.sendErrorReport(errorReport);
      } catch (error) {
        console.error('Failed to send queued error:', error);
        // 重新加入队列尾部
        this.queueError(errorReport);
      }
    }
  }

  /**
   * 显示错误通知
   */
  private showErrorNotification(errorReport: ErrorReport, context: {
    isNetworkError: boolean;
    isRateLimitError: boolean;
    isAuthError: boolean;
  }): void {
    // 这里可以集成 toast UI 库来显示错误通知
    console.group('🚨 Application Error');
    console.error('Error:', errorReport.error);
    console.error('Type:', context);
    if (errorReport.stack) {
      console.error('Stack:', errorReport.stack);
    }
    console.groupEnd();

    // 示例：显示通知
    // if (context.isNetworkError) {
    //   toast.error('网络连接错误，请检查网络连接');
    // } else if (context.isRateLimitError) {
    //   toast.error('API 请求过于频繁，请稍后再试');
    // } else if (context.isAuthError) {
    //   toast.error('认证失败，请重新登录');
    // } else {
    //   toast.error('应用程序发生错误');
    // }
  }

  /**
   * 手动报错
   */
  public reportError(error: Error | string, context?: Record<string, unknown>): void {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    const errorReport = this.createErrorReport(errorObj, context);
    this.processError(errorReport);
  }

  /**
   * 获取错误统计信息
   */
  public getErrorStats(): {
    queueSize: number;
    isOnline: boolean;
    lastError?: ErrorReport;
  } {
    return {
      queueSize: this.errorQueue.length,
      isOnline: this.isOnline,
      lastError: this.errorQueue[this.errorQueue.length - 1],
    };
  }
}

// 导出单例实例
export const globalErrorHandler = GlobalErrorHandler.getInstance();

// 确保在应用启动时初始化全局错误处理
if (typeof window !== 'undefined') {
  globalErrorHandler.initialize();
}
