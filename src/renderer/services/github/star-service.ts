import { octokitManager } from "./octokit-manager";
import { indexedDBStorage } from "../indexeddb-storage";
import type {
  GitHubRepository,
  GitHubError,
  PaginationInfo,
  StarredRepository,
} from "./types";

/**
 * GitHub Star 服务类
 * 专门处理仓库收藏相关的 API 操作
 */
export class GitHubStarService {
  /**
   * 获取当前用户收藏的仓库列表
   */
  async getStarredRepositories(
    options: {
      sort?: "created" | "updated";
      direction?: "asc" | "desc";
      per_page?: number;
      page?: number;
    } = {},
  ): Promise<{
    repositories: StarredRepository[];
    pagination: PaginationInfo;
  }> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      const {
        sort = "created",
        direction = "desc",
        per_page = 30,
        page = 1,
      } = options;

      const { data } =
        await octokit.rest.activity.listReposStarredByAuthenticatedUser({
          sort,
          direction,
          per_page,
          page,
          headers: {
            Accept: "application/vnd.github.v3.star+json",
          },
        });

      const repositories: StarredRepository[] = data.map((item: any) => ({
        ...this.mapToGitHubRepository(item.repo),
        starred_at: item.starred_at,
      }));

      const pagination: PaginationInfo = {
        page,
        per_page,
        has_next_page: data.length === per_page,
        has_prev_page: page > 1,
      };

      return {
        repositories,
        pagination,
      };
    } catch (error) {
      throw this.handleError(error, "获取收藏仓库列表失败");
    }
  }

  /**
   * 获取指定用户收藏的仓库列表
   */
  async getUserStarredRepositories(
    username: string,
    options: {
      sort?: "created" | "updated";
      direction?: "asc" | "desc";
      per_page?: number;
      page?: number;
    } = {},
  ): Promise<{
    repositories: GitHubRepository[];
    pagination: PaginationInfo;
  }> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      const {
        sort = "created",
        direction = "desc",
        per_page = 30,
        page = 1,
      } = options;

      const { data } = await octokit.rest.activity.listReposStarredByUser({
        username,
        sort,
        direction,
        per_page,
        page,
      });

      const repositories: GitHubRepository[] = data.map((repo: any) =>
        this.mapToGitHubRepository(repo),
      );

      const pagination: PaginationInfo = {
        page,
        per_page,
        has_next_page: data.length === per_page,
        has_prev_page: page > 1,
      };

      return {
        repositories,
        pagination,
      };
    } catch (error) {
      throw this.handleError(error, `获取用户 ${username} 的收藏仓库列表失败`);
    }
  }

  /**
   * 检查仓库是否被当前用户收藏
   */
  async checkIfStarred(owner: string, repo: string): Promise<boolean> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      try {
        await octokit.rest.activity.checkRepoIsStarredByAuthenticatedUser({
          owner,
          repo,
        });
        return true;
      } catch (error: any) {
        if (error.status === 404) {
          return false;
        }
        throw error;
      }
    } catch (error) {
      throw this.handleError(error, `检查仓库 ${owner}/${repo} 收藏状态失败`);
    }
  }

  /**
   * 收藏仓库
   */
  async starRepository(owner: string, repo: string): Promise<void> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      await octokit.rest.activity.starRepoForAuthenticatedUser({
        owner,
        repo,
      });
    } catch (error) {
      throw this.handleError(error, `收藏仓库 ${owner}/${repo} 失败`);
    }
  }

  /**
   * 取消收藏仓库
   */
  async unstarRepository(owner: string, repo: string): Promise<void> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      await octokit.rest.activity.unstarRepoForAuthenticatedUser({
        owner,
        repo,
      });
    } catch (error) {
      throw this.handleError(error, `取消收藏仓库 ${owner}/${repo} 失败`);
    }
  }

  /**
   * 批量检查仓库收藏状态
   */
  async checkMultipleStarStatus(
    repositories: Array<{ owner: string; repo: string }>,
  ): Promise<Array<{ owner: string; repo: string; isStarred: boolean }>> {
    const results = [];

    for (const { owner, repo } of repositories) {
      try {
        const isStarred = await this.checkIfStarred(owner, repo);
        results.push({ owner, repo, isStarred });
      } catch (error) {
        console.warn(`检查仓库 ${owner}/${repo} 收藏状态失败:`, error);
        results.push({ owner, repo, isStarred: false });
      }
    }

    return results;
  }

  /**
   * 批量收藏仓库
   */
  async starMultipleRepositories(
    repositories: Array<{ owner: string; repo: string }>,
  ): Promise<
    Array<{ owner: string; repo: string; success: boolean; error?: string }>
  > {
    const results = [];

    for (const { owner, repo } of repositories) {
      try {
        await this.starRepository(owner, repo);
        results.push({ owner, repo, success: true });
      } catch (error: any) {
        console.warn(`收藏仓库 ${owner}/${repo} 失败:`, error);
        results.push({
          owner,
          repo,
          success: false,
          error: error.message || "未知错误",
        });
      }
    }

    return results;
  }

  /**
   * 批量取消收藏仓库
   */
  async unstarMultipleRepositories(
    repositories: Array<{ owner: string; repo: string }>,
  ): Promise<
    Array<{ owner: string; repo: string; success: boolean; error?: string }>
  > {
    const results = [];

    for (const { owner, repo } of repositories) {
      try {
        await this.unstarRepository(owner, repo);
        results.push({ owner, repo, success: true });
      } catch (error: any) {
        console.warn(`取消收藏仓库 ${owner}/${repo} 失败:`, error);
        results.push({
          owner,
          repo,
          success: false,
          error: error.message || "未知错误",
        });
      }
    }

    return results;
  }

  /**
   * 获取所有收藏的仓库（支持缓存）
   */
  async getAllStarredRepositories(
    options: {
      onProgress?: (loaded: number, total?: number) => void;
      batchSize?: number;
      forceRefresh?: boolean; // 强制从API刷新
      useCache?: boolean; // 是否使用缓存
    } = {},
  ): Promise<{
    repositories: StarredRepository[];
    totalLoaded: number;
    fromCache?: boolean;
  }> {
    const {
      onProgress,
      batchSize = 100,
      forceRefresh = false,
      useCache = true
    } = options;

    try {
      // 获取当前用户信息
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      // 获取当前用户信息用于缓存键
      const userResponse = await octokit.rest.users.getAuthenticated();
      const userLogin = userResponse.data.login;

      // 检查缓存（除非强制刷新或禁用缓存）
      if (useCache && !forceRefresh) {
        try {
          const cachedData = await indexedDBStorage.loadRepositories(userLogin);
          if (cachedData && indexedDBStorage.isCacheFresh(cachedData.metadata)) {
            console.log(`从缓存加载 ${cachedData.repositories.length} 个仓库`);
            return {
              repositories: cachedData.repositories,
              totalLoaded: cachedData.repositories.length,
              fromCache: true,
            };
          }
        } catch (cacheError) {
          console.warn("读取缓存失败，将从API获取:", cacheError);
        }
      }

      // 从API获取数据
      console.log("从GitHub API获取仓库数据...");
      const allRepositories: StarredRepository[] = [];
      let page = 1;
      let hasNextPage = true;
      let totalLoaded = 0;

      // 首次获取第一页
      const firstPageData = await this.getStarredRepositories({
        per_page: batchSize,
        page: 1,
      });

      allRepositories.push(...firstPageData.repositories);
      totalLoaded += firstPageData.repositories.length;
      hasNextPage = firstPageData.pagination.has_next_page;
      page++;

      // 报告初始进度
      onProgress?.(totalLoaded);

      // 循环获取剩余页面
      while (hasNextPage) {
        try {
          const pageData = await this.getStarredRepositories({
            per_page: batchSize,
            page,
          });

          allRepositories.push(...pageData.repositories);
          totalLoaded += pageData.repositories.length;
          hasNextPage = pageData.pagination.has_next_page;
          page++;

          // 报告进度
          onProgress?.(totalLoaded);

          // 添加小延迟避免API速率限制
          if (hasNextPage) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.warn(`获取第${page}页数据失败:`, error);
          // 如果是速率限制错误，等待更长时间
          if (error instanceof Error && error.message.includes('rate limit')) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          // 其他错误则停止加载
          break;
        }
      }

      // 保存到缓存（异步，不阻塞返回）
      if (useCache) {
        indexedDBStorage.saveRepositories(userLogin, allRepositories)
          .then(() => console.log(`已保存 ${allRepositories.length} 个仓库到缓存`))
          .catch(error => console.warn("保存缓存失败:", error));
      }

      return {
        repositories: allRepositories,
        totalLoaded,
        fromCache: false,
      };
    } catch (error) {
      throw this.handleError(error, "获取所有收藏仓库失败");
    }
  }

  /**
   * 获取收藏仓库的统计信息
   */
  async getStarredRepositoriesStats(): Promise<{
    total_count: number;
    languages: Record<string, number>;
    topics: Record<string, number>;
    most_starred: GitHubRepository | null;
    recently_starred: GitHubRepository | null;
  }> {
    try {
      // 获取第一页数据来计算统计信息
      const { repositories } = await this.getStarredRepositories({
        per_page: 100,
        page: 1,
      });

      const languages: Record<string, number> = {};
      const topics: Record<string, number> = {};
      let mostStarred: GitHubRepository | null = null;
      let recentlyStarred: GitHubRepository | null = null;

      repositories.forEach((repo) => {
        // 统计语言
        if (repo.language) {
          languages[repo.language] = (languages[repo.language] || 0) + 1;
        }

        // 统计主题
        repo.topics.forEach((topic: string) => {
          topics[topic] = (topics[topic] || 0) + 1;
        });

        // 找到最多星标的仓库
        if (
          !mostStarred ||
          repo.stargazers_count > mostStarred.stargazers_count
        ) {
          mostStarred = repo;
        }

        // 最近收藏的仓库（第一个，因为默认按创建时间倒序）
        if (!recentlyStarred) {
          recentlyStarred = repo;
        }
      });

      return {
        total_count: repositories.length,
        languages,
        topics,
        most_starred: mostStarred,
        recently_starred: recentlyStarred,
      };
    } catch (error) {
      throw this.handleError(error, "获取收藏仓库统计信息失败");
    }
  }

  /**
   * 获取时间序列统计数据
   */
  async getStarredTimeSeriesStats(
    period: 'day' | 'week' | 'month' | 'year' = 'month',
    limit: number = 12
  ): Promise<{
    period: string;
    data: Array<{
      date: string;
      count: number;
      cumulative: number;
    }>;
  }> {
    try {
      // 获取所有收藏的仓库数据
      const { repositories: allStarred } = await this.getAllStarredRepositories({
        forceRefresh: false,
        useCache: true,
      });

      // 按收藏时间排序（最新的在前）
      const sortedRepos = allStarred.sort((a, b) =>
        new Date(b.starred_at).getTime() - new Date(a.starred_at).getTime()
      );

      // 生成时间序列数据
      const timeSeries: Array<{
        date: string;
        count: number;
        cumulative: number;
      }> = [];

      const now = new Date();
      let cumulative = 0;

      // 根据周期生成时间点
      for (let i = limit - 1; i >= 0; i--) {
        let periodStart: Date;
        let periodEnd: Date;
        let periodLabel: string;

        switch (period) {
          case 'day':
            periodStart = new Date(now);
            periodStart.setDate(now.getDate() - i);
            periodStart.setHours(0, 0, 0, 0);

            periodEnd = new Date(periodStart);
            periodEnd.setHours(23, 59, 59, 999);

            periodLabel = periodStart.toISOString().split('T')[0];
            break;

          case 'week':
            periodStart = new Date(now);
            periodStart.setDate(now.getDate() - (i * 7) - now.getDay());
            periodStart.setHours(0, 0, 0, 0);

            periodEnd = new Date(periodStart);
            periodEnd.setDate(periodStart.getDate() + 6);
            periodEnd.setHours(23, 59, 59, 999);

            periodLabel = `${periodStart.getFullYear()}-W${Math.ceil((periodStart.getTime() - new Date(periodStart.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`;
            break;

          case 'month':
            periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);

            periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
            periodEnd.setHours(23, 59, 59, 999);

            periodLabel = periodStart.toISOString().slice(0, 7);
            break;

          case 'year':
            periodStart = new Date(now.getFullYear() - i, 0, 1);

            periodEnd = new Date(now.getFullYear() - i, 11, 31);
            periodEnd.setHours(23, 59, 59, 999);

            periodLabel = periodStart.getFullYear().toString();
            break;

          default:
            periodStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
            periodEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
            periodEnd.setHours(23, 59, 59, 999);
            periodLabel = periodStart.toISOString().slice(0, 7);
        }

        // 统计该时间段内的收藏数量
        const periodCount = sortedRepos.filter(repo => {
          const starredTime = new Date(repo.starred_at);
          return starredTime >= periodStart && starredTime <= periodEnd;
        }).length;

        cumulative += periodCount;

        timeSeries.push({
          date: periodLabel,
          count: periodCount,
          cumulative: cumulative,
        });
      }

      return {
        period,
        data: timeSeries,
      };
    } catch (error) {
      throw this.handleError(error, "获取时间序列统计数据失败");
    }
  }

  /**
   * 获取扩展的统计信息（包含时间序列）
   */
  async getExtendedStats(): Promise<{
    basic: {
      total_count: number;
      languages: Record<string, number>;
      topics: Record<string, number>;
      most_starred: GitHubRepository | null;
      recently_starred: GitHubRepository | null;
    };
    timeSeries: {
      monthly: Array<{
        date: string;
        count: number;
        cumulative: number;
      }>;
      weekly: Array<{
        date: string;
        count: number;
        cumulative: number;
      }>;
    };
    insights: {
      avgStarsPerMonth: number;
      mostActiveMonth: string;
      topLanguages: Array<{ name: string; count: number; percentage: number }>;
      topTopics: Array<{ name: string; count: number; percentage: number }>;
    };
  }> {
    try {
      // 获取基础统计
      const basic = await this.getStarredRepositoriesStats();

      // 获取时间序列数据
      const [monthlyData, weeklyData] = await Promise.all([
        this.getStarredTimeSeriesStats('month', 12),
        this.getStarredTimeSeriesStats('week', 12),
      ]);

      // 计算洞察信息
      const totalRepos = basic.total_count;

      // 计算每月平均收藏数
      const avgStarsPerMonth = monthlyData.data.length > 0
        ? monthlyData.data.reduce((sum, item) => sum + item.count, 0) / monthlyData.data.length
        : 0;

      // 找到最活跃的月份
      const mostActiveMonth = monthlyData.data.length > 0
        ? monthlyData.data.reduce((max, current) => current.count > max.count ? current : max).date
        : '';

      // 计算热门语言占比
      const topLanguages = Object.entries(basic.languages)
        .map(([name, count]) => ({
          name,
          count,
          percentage: totalRepos > 0 ? (count / totalRepos) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // 计算热门主题占比
      const topTopics = Object.entries(basic.topics)
        .map(([name, count]) => ({
          name,
          count,
          percentage: totalRepos > 0 ? (count / totalRepos) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        basic,
        timeSeries: {
          monthly: monthlyData.data,
          weekly: weeklyData.data,
        },
        insights: {
          avgStarsPerMonth: Math.round(avgStarsPerMonth * 100) / 100,
          mostActiveMonth,
          topLanguages,
          topTopics,
        },
      };
    } catch (error) {
      throw this.handleError(error, "获取扩展统计信息失败");
    }
  }

  /**
   * 搜索收藏的仓库
   */
  async searchStarredRepositories(
    query: string,
    options: {
      language?: string;
      topic?: string;
      sort?: "created" | "updated" | "stars";
      direction?: "asc" | "desc";
    } = {},
  ): Promise<{
    repositories: StarredRepository[];
    total_count: number;
  }> {
    try {
      // 获取所有收藏的仓库（这里简化处理，实际应用中可能需要分页处理）
      const { repositories: allStarred } = await this.getStarredRepositories({
        per_page: 1000, // 获取更多数据
      });

      // 在本地进行搜索过滤
      const filteredRepositories = allStarred.filter((repo) => {
        const matchesQuery =
          !query ||
          repo.name.toLowerCase().includes(query.toLowerCase()) ||
          repo.description?.toLowerCase().includes(query.toLowerCase()) ||
          repo.full_name.toLowerCase().includes(query.toLowerCase());

        const matchesLanguage =
          !options.language ||
          repo.language?.toLowerCase() === options.language.toLowerCase();

        const matchesTopic =
          !options.topic ||
          repo.topics.some(
            (topic: string) =>
              topic.toLowerCase() === options.topic?.toLowerCase(),
          );

        return matchesQuery && matchesLanguage && matchesTopic;
      });

      // 排序
      if (options.sort) {
        filteredRepositories.sort((a, b) => {
          let aValue: any, bValue: any;

          switch (options.sort) {
            case "created":
              aValue = new Date(a.starred_at).getTime();
              bValue = new Date(b.starred_at).getTime();
              break;
            case "updated":
              aValue = new Date(a.updated_at).getTime();
              bValue = new Date(b.updated_at).getTime();
              break;
            case "stars":
              aValue = a.stargazers_count;
              bValue = b.stargazers_count;
              break;
            default:
              return 0;
          }

          const result = aValue - bValue;
          return options.direction === "asc" ? result : -result;
        });
      }

      return {
        repositories: filteredRepositories,
        total_count: filteredRepositories.length,
      };
    } catch (error) {
      throw this.handleError(error, "搜索收藏仓库失败");
    }
  }

  /**
   * 将API返回的仓库数据映射为GitHubRepository接口
   */
  private mapToGitHubRepository(repo: any): GitHubRepository {
    return {
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      html_url: repo.html_url,
      clone_url: repo.clone_url,
      ssh_url: repo.ssh_url,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      watchers_count: repo.watchers_count,
      forks_count: repo.forks_count,
      open_issues_count: repo.open_issues_count,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      pushed_at: repo.pushed_at,
      size: repo.size,
      default_branch: repo.default_branch,
      topics: repo.topics || [],
      archived: repo.archived,
      disabled: repo.disabled,
      private: repo.private,
      fork: repo.fork,
      owner: {
        id: repo.owner.id,
        login: repo.owner.login,
        avatar_url: repo.owner.avatar_url,
      },
    };
  }

  /**
   * 错误处理
   */
  private handleError(error: any, message: string): GitHubError {
    console.error(message, error);

    if (error.response) {
      return {
        message: `${message}: ${error.response.data?.message || error.message}`,
        status: error.response.status,
        code: error.response.data?.errors?.[0]?.code,
        documentation_url: error.response.data?.documentation_url,
      };
    }

    return {
      message: `${message}: ${error.message || "未知错误"}`,
    };
  }
}

// 导出单例实例
export const githubStarService = new GitHubStarService();
export default githubStarService;
