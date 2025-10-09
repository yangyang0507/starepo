import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "octokit";
import type {
  GitHubClientConfig,
  RateLimitInfo,
  GitHubUser,
  GitHubRepository,
} from "./types";
import { getLogger } from "../../utils/logger";

// 扩展 Octokit 功能
const MyOctokit = Octokit.plugin(throttling, retry);

export class OctokitManager {
  private static instance: OctokitManager;
  private octokit: Octokit | null = null;
  private config: GitHubClientConfig | null = null;
  private rateLimitInfo: RateLimitInfo | null = null;
  private isInitialized = false;
  private readonly log = getLogger("github:octokit");

  private constructor() {}

  static getInstance(): OctokitManager {
    if (!OctokitManager.instance) {
      OctokitManager.instance = new OctokitManager();
    }
    return OctokitManager.instance;
  }

  // 初始化 Octokit 客户端
  async initialize(config: GitHubClientConfig): Promise<void> {
    try {
      this.config = config;

      const octokitConfig: any = {
        userAgent: config.userAgent || "Starepo/1.0.0",
        baseUrl: config.baseUrl || "https://api.github.com",
        request: {
          timeout: config.timeout || 10000,
        },
        throttle: {
          onRateLimit: this.handleRateLimit.bind(this),
          onSecondaryRateLimit: this.handleSecondaryRateLimit.bind(this),
        },
        retry: {
          doNotRetry: ["400", "401", "403", "404", "422"],
        },
      };

      // 根据认证方式设置认证
      if (config.authMethod === "token" && config.token) {
        octokitConfig.auth = config.token;
      }

      this.octokit = new MyOctokit(octokitConfig);
      this.isInitialized = true;

      // 验证认证并获取用户信息
      await this.validateAuthentication();

      this.log.info("Octokit 客户端初始化成功");
    } catch (error) {
      this.isInitialized = false;
      this.log.error("Octokit 客户端初始化失败", error);
      throw new Error(
        `GitHub 客户端初始化失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  // 验证认证状态
  async validateAuthentication(): Promise<GitHubUser> {
    if (!this.octokit) {
      throw new Error("Octokit 客户端未初始化");
    }

    try {
      const { data: user } = await this.octokit.rest.users.getAuthenticated();
      await this.updateRateLimitInfo();
      return user as GitHubUser;
    } catch (error) {
      this.log.error("认证验证失败", error);
      throw new Error(
        `认证验证失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  // 获取当前用户信息
  async getCurrentUser(): Promise<GitHubUser> {
    if (!this.isAuthenticated()) {
      throw new Error("未认证或客户端未初始化");
    }

    try {
      const { data: user } = await this.octokit!.rest.users.getAuthenticated();
      return user as GitHubUser;
    } catch (error) {
      this.log.error("获取用户信息失败", error);
      throw new Error(
        `获取用户信息失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  // 获取用户的 starred 仓库
  async getStarredRepositories(
    page = 1,
    perPage = 30,
  ): Promise<GitHubRepository[]> {
    if (!this.isAuthenticated()) {
      throw new Error("未认证或客户端未初始化");
    }

    try {
      const { data: repos } =
        await this.octokit!.rest.activity.listReposStarredByAuthenticatedUser({
          page,
          per_page: perPage,
          sort: "updated",
          direction: "desc",
        });

      await this.updateRateLimitInfo();
      return repos as GitHubRepository[];
    } catch (error) {
      this.log.error("获取 starred 仓库失败", error);
      throw new Error(
        `获取 starred 仓库失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  // Star 一个仓库
  async starRepository(owner: string, repo: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("未认证或客户端未初始化");
    }

    try {
      await this.octokit!.rest.activity.starRepoForAuthenticatedUser({
        owner,
        repo,
      });
      await this.updateRateLimitInfo();
      this.log.info("成功 star 仓库", { owner, repo });
    } catch (error) {
      this.log.error("Star 仓库失败", error);
      throw new Error(
        `Star 仓库失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  // Unstar 一个仓库
  async unstarRepository(owner: string, repo: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error("未认证或客户端未初始化");
    }

    try {
      await this.octokit!.rest.activity.unstarRepoForAuthenticatedUser({
        owner,
        repo,
      });
      await this.updateRateLimitInfo();
      this.log.info("成功 unstar 仓库", { owner, repo });
    } catch (error) {
      this.log.error("Unstar 仓库失败", error);
      throw new Error(
        `Unstar 仓库失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  // 检查是否已 star 某个仓库
  async checkIfStarred(owner: string, repo: string): Promise<boolean> {
    if (!this.isAuthenticated()) {
      throw new Error("未认证或客户端未初始化");
    }

    try {
      await this.octokit!.rest.activity.checkRepoIsStarredByAuthenticatedUser({
        owner,
        repo,
      });
      await this.updateRateLimitInfo();
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        return false;
      }
      this.log.error("检查 star 状态失败", error);
      throw new Error(
        `检查 star 状态失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  // 获取仓库详细信息
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    if (!this.isAuthenticated()) {
      throw new Error("未认证或客户端未初始化");
    }

    try {
      const { data: repository } = await this.octokit!.rest.repos.get({
        owner,
        repo,
      });
      await this.updateRateLimitInfo();
      return repository as GitHubRepository;
    } catch (error) {
      this.log.error("获取仓库信息失败", error);
      throw new Error(
        `获取仓库信息失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  // 搜索仓库
  async searchRepositories(
    query: string,
    page = 1,
    perPage = 30,
  ): Promise<{ repositories: GitHubRepository[]; total_count: number }> {
    if (!this.isAuthenticated()) {
      throw new Error("未认证或客户端未初始化");
    }

    try {
      const { data } = await this.octokit!.rest.search.repos({
        q: query,
        page,
        per_page: perPage,
        sort: "stars",
        order: "desc",
      });

      await this.updateRateLimitInfo();
      return {
        repositories: data.items as GitHubRepository[],
        total_count: data.total_count,
      };
    } catch (error) {
      this.log.error("搜索仓库失败", error);
      throw new Error(
        `搜索仓库失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    }
  }

  // 更新速率限制信息
  private async updateRateLimitInfo(): Promise<void> {
    if (!this.octokit) return;

    try {
      const { data: rateLimit } = await this.octokit.rest.rateLimit.get();
      this.rateLimitInfo = {
        core: {
          limit: rateLimit.resources.core.limit,
          remaining: rateLimit.resources.core.remaining,
          reset: new Date(rateLimit.resources.core.reset * 1000),
          used: rateLimit.resources.core.used,
        },
        search: {
          limit: rateLimit.resources.search.limit,
          remaining: rateLimit.resources.search.remaining,
          reset: new Date(rateLimit.resources.search.reset * 1000),
          used: rateLimit.resources.search.used,
        },
        graphql: {
          limit: rateLimit.resources.graphql?.limit || 0,
          remaining: rateLimit.resources.graphql?.remaining || 0,
          reset: new Date((rateLimit.resources.graphql?.reset || 0) * 1000),
          used: rateLimit.resources.graphql?.used || 0,
        },
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.log.warn("获取速率限制信息失败", error);
    }
  }

  // 处理速率限制
  private handleRateLimit(retryAfter: number, _options: unknown): boolean {
    this.log.warn("触发速率限制，等待后重试", { retryAfterSeconds: retryAfter });
    return true; // 允许重试
  }

  // 处理二级速率限制
  private handleSecondaryRateLimit(retryAfter: number, _options: unknown): boolean {
    this.log.warn("触发二级速率限制，等待后重试", { retryAfterSeconds: retryAfter });
    return true; // 允许重试
  }

  // 检查是否已认证
  isAuthenticated(): boolean {
    return this.isInitialized && this.octokit !== null;
  }

  // 获取速率限制信息
  getRateLimitInfo(): RateLimitInfo | null {
    return this.rateLimitInfo;
  }

  // 获取配置信息
  getConfig(): GitHubClientConfig | null {
    return this.config;
  }

  // 重置客户端
  reset(): void {
    this.octokit = null;
    this.config = null;
    this.rateLimitInfo = null;
    this.isInitialized = false;
    this.log.info("Octokit 客户端已重置");
  }

  // 获取 Octokit 实例（用于高级操作）
  getOctokit(): Octokit | null {
    return this.octokit;
  }
}

// 导出单例实例
export const octokitManager = OctokitManager.getInstance();
