import http from 'http';
import https from 'https';

interface AgentOptions {
  keepAlive?: boolean;
  keepAliveMsecs?: number;
  maxSockets?: number;
  maxFreeSockets?: number;
  timeout?: number;
  scheduling?: 'lifo' | 'fifo';
}

/**
 * 连接池管理器
 * 管理 HTTP/HTTPS 连接池，提高网络性能
 */
export class ConnectionManager {
  private httpAgents = new Map<string, http.Agent>();
  private httpsAgents = new Map<string, https.Agent>();

  constructor(
    private defaultOptions: AgentOptions = {
      keepAlive: true,
      keepAliveMsecs: 30000,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 60000,
      scheduling: 'lifo', // 优先复用最近使用的连接
    }
  ) {}

  /**
   * 获取或创建 HTTP Agent
   */
  getAgent(baseUrl: string, options?: AgentOptions): http.Agent | https.Agent {
    const isHttps = baseUrl.startsWith('https');
    const cacheKey = this.getCacheKey(baseUrl, options);

    if (isHttps) {
      return this.getHttpsAgent(cacheKey, options);
    } else {
      return this.getHttpAgent(cacheKey, options);
    }
  }

  /**
   * 获取 HTTP Agent
   */
  private getHttpAgent(key: string, options?: AgentOptions): http.Agent {
    if (!this.httpAgents.has(key)) {
      const agent = new http.Agent({
        ...this.defaultOptions,
        ...options,
      });
      this.httpAgents.set(key, agent);
    }
    return this.httpAgents.get(key)!;
  }

  /**
   * 获取 HTTPS Agent
   */
  private getHttpsAgent(key: string, options?: AgentOptions): https.Agent {
    if (!this.httpsAgents.has(key)) {
      const agent = new https.Agent({
        ...this.defaultOptions,
        ...options,
      });
      this.httpsAgents.set(key, agent);
    }
    return this.httpsAgents.get(key)!;
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(baseUrl: string, options?: AgentOptions): string {
    const url = new URL(baseUrl);
    const host = url.host;
    const optionsKey = options ? JSON.stringify(options) : 'default';
    return `${host}:${optionsKey}`;
  }

  /**
   * 销毁指定的 Agent
   */
  destroy(baseUrl: string): void {
    const isHttps = baseUrl.startsWith('https');
    const cacheKey = this.getCacheKey(baseUrl);

    if (isHttps) {
      const agent = this.httpsAgents.get(cacheKey);
      if (agent) {
        agent.destroy();
        this.httpsAgents.delete(cacheKey);
      }
    } else {
      const agent = this.httpAgents.get(cacheKey);
      if (agent) {
        agent.destroy();
        this.httpAgents.delete(cacheKey);
      }
    }
  }

  /**
   * 销毁所有 Agent
   */
  destroyAll(): void {
    for (const agent of this.httpAgents.values()) {
      agent.destroy();
    }
    for (const agent of this.httpsAgents.values()) {
      agent.destroy();
    }
    this.httpAgents.clear();
    this.httpsAgents.clear();
  }

  /**
   * 获取连接池统计信息
   */
  get stats() {
    const httpStats = Array.from(this.httpAgents.entries()).map(([key, agent]) => ({
      key,
      type: 'http',
      sockets: Object.keys((agent as any).sockets || {}).length,
      freeSockets: Object.keys((agent as any).freeSockets || {}).length,
      requests: Object.keys((agent as any).requests || {}).length,
    }));

    const httpsStats = Array.from(this.httpsAgents.entries()).map(([key, agent]) => ({
      key,
      type: 'https',
      sockets: Object.keys((agent as any).sockets || {}).length,
      freeSockets: Object.keys((agent as any).freeSockets || {}).length,
      requests: Object.keys((agent as any).requests || {}).length,
    }));

    return {
      totalAgents: this.httpAgents.size + this.httpsAgents.size,
      httpAgents: this.httpAgents.size,
      httpsAgents: this.httpsAgents.size,
      details: [...httpStats, ...httpsStats],
    };
  }
}

// 全局连接管理器实例
export const globalConnectionManager = new ConnectionManager();
