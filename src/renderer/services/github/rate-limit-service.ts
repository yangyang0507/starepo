import { octokitManager } from "./octokit-manager";
import type { RateLimitInfo, RateLimitEvent } from "./types";

/**
 * GitHub API速率限制监控和管理服务
 * 负责监控API调用频率、实现智能重试和速率限制预警
 */
export class GitHubRateLimitService {
  private rateLimitInfo: RateLimitInfo | null = null;
  private eventListeners: Array<(event: RateLimitEvent) => void> = [];
  private checkInterval: NodeJS.Timeout | null = null;
  private retryQueue: Array<{
    fn: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    retryCount: number;
    maxRetries: number;
  }> = [];
  private isProcessingQueue = false;

  constructor() {
    this.startRateLimitMonitoring();
  }

  /**
   * 获取当前速率限制信息
   */
  async getRateLimitInfo(): Promise<RateLimitInfo> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化");
      }

      const response = await octokit.rest.rateLimit.get();
      const { core, search, graphql } = response.data.resources;

      this.rateLimitInfo = {
        core: {
          limit: core.limit,
          remaining: core.remaining,
          reset: new Date(core.reset * 1000),
          used: core.used,
        },
        search: {
          limit: search.limit,
          remaining: search.remaining,
          reset: new Date(search.reset * 1000),
          used: search.used,
        },
        graphql: {
          limit: graphql?.limit || 0,
          remaining: graphql?.remaining || 0,
          reset: new Date((graphql?.reset || 0) * 1000),
          used: graphql?.used || 0,
        },
        lastUpdated: new Date(),
      };

      this.emitEvent({
        type: "rate-limit-updated",
        data: this.rateLimitInfo,
        timestamp: Date.now(),
      });

      return this.rateLimitInfo;
    } catch (error) {
      console.error("获取速率限制信息失败:", error);
      throw error;
    }
  }

  /**
   * 检查是否可以进行API调用
   */
  canMakeRequest(type: "core" | "search" | "graphql" = "core"): boolean {
    if (!this.rateLimitInfo) {
      return true; // 如果没有速率限制信息，允许调用
    }

    const limit = this.rateLimitInfo[type];
    return limit.remaining > 0;
  }

  /**
   * 获取下次重置时间
   */
  getResetTime(type: "core" | "search" | "graphql" = "core"): Date | null {
    if (!this.rateLimitInfo) {
      return null;
    }

    return this.rateLimitInfo[type].reset;
  }

  /**
   * 计算等待时间（毫秒）
   */
  getWaitTime(type: "core" | "search" | "graphql" = "core"): number {
    const resetTime = this.getResetTime(type);
    if (!resetTime) {
      return 0;
    }

    const now = new Date();
    const waitTime = resetTime.getTime() - now.getTime();
    return Math.max(0, waitTime);
  }

  /**
   * 智能重试包装器
   */
  async withRetry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
      type?: "core" | "search" | "graphql";
    } = {},
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 60000,
      type = "core",
    } = options;

    return new Promise((resolve, reject) => {
      this.retryQueue.push({
        fn,
        resolve,
        reject,
        retryCount: 0,
        maxRetries,
      });

      this.processRetryQueue();
    });
  }

  /**
   * 处理重试队列
   */
  private async processRetryQueue(): Promise<void> {
    if (this.isProcessingQueue || this.retryQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.retryQueue.length > 0) {
      const item = this.retryQueue.shift()!;

      try {
        const result = await item.fn();
        item.resolve(result);
      } catch (error: any) {
        if (this.isRateLimitError(error) && item.retryCount < item.maxRetries) {
          // 速率限制错误，重新加入队列
          item.retryCount++;
          this.retryQueue.unshift(item);

          // 等待重置时间
          const waitTime = this.getWaitTime();
          if (waitTime > 0) {
            this.emitEvent({
              type: "rate-limit-exceeded",
              data: {
                waitTime,
                resetTime: this.getResetTime()!,
              },
              timestamp: Date.now(),
            });

            await this.sleep(Math.min(waitTime, 60000)); // 最多等待1分钟
          }
        } else {
          item.reject(error);
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * 检查是否为速率限制错误
   */
  private isRateLimitError(error: any): boolean {
    return (
      error?.status === 403 &&
      (error?.message?.includes("rate limit") ||
        error?.message?.includes("API rate limit exceeded"))
    );
  }

  /**
   * 开始速率限制监控
   */
  private startRateLimitMonitoring(): void {
    // 每分钟检查一次速率限制
    this.checkInterval = setInterval(async () => {
      try {
        await this.getRateLimitInfo();

        // 检查是否接近限制
        if (this.rateLimitInfo) {
          const { core, search } = this.rateLimitInfo;

          if (core.remaining < core.limit * 0.1) {
            // 剩余不到10%
            this.emitEvent({
              type: "rate-limit-warning",
              data: {
                type: "core",
                remaining: core.remaining,
                limit: core.limit,
                resetTime: core.reset,
              },
              timestamp: Date.now(),
            });
          }

          if (search.remaining < search.limit * 0.1) {
            this.emitEvent({
              type: "rate-limit-warning",
              data: {
                type: "search",
                remaining: search.remaining,
                limit: search.limit,
                resetTime: search.reset,
              },
              timestamp: Date.now(),
            });
          }
        }
      } catch (error) {
        console.error("速率限制监控失败:", error);
      }
    }, 60000); // 每分钟检查一次
  }

  /**
   * 停止速率限制监控
   */
  stopRateLimitMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * 添加事件监听器
   */
  addEventListener(listener: (event: RateLimitEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: (event: RateLimitEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * 发送事件
   */
  private emitEvent(event: RateLimitEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("速率限制事件监听器错误:", error);
      }
    });
  }

  /**
   * 睡眠函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取使用统计
   */
  getUsageStats(): {
    core: { used: number; limit: number; percentage: number };
    search: { used: number; limit: number; percentage: number };
    graphql: { used: number; limit: number; percentage: number };
  } | null {
    if (!this.rateLimitInfo) {
      return null;
    }

    const { core, search, graphql } = this.rateLimitInfo;

    return {
      core: {
        used: core.used,
        limit: core.limit,
        percentage: (core.used / core.limit) * 100,
      },
      search: {
        used: search.used,
        limit: search.limit,
        percentage: (search.used / search.limit) * 100,
      },
      graphql: {
        used: graphql.used,
        limit: graphql.limit,
        percentage: (graphql.used / graphql.limit) * 100,
      },
    };
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.stopRateLimitMonitoring();
    this.eventListeners = [];
    this.retryQueue = [];
  }
}

// 导出单例实例
export const githubRateLimitService = new GitHubRateLimitService();
export default githubRateLimitService;
