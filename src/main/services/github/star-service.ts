import { octokitManager } from "./octokit-manager";
import { lancedbService } from "../database/lancedb-service";
import type {
  GitHubRepository,
  GitHubError,
  PaginationInfo,
  StarredRepository,
} from "./types";
import type { SearchResult } from "../database/types";

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
        ...this.mapToGitHubRepository(item.repo || item),
        starred_at: item.starred_at || new Date().toISOString(),
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
          error: error instanceof Error ? error.message : "未知错误",
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
          error: error instanceof Error ? error.message : "未知错误",
        });
      }
    }

    return results;
  }

  /**
   * 获取所有收藏的仓库
   */
  async getAllStarredRepositories(
    options: {
      onProgress?: (loaded: number, total?: number) => void;
      batchSize?: number;
      forceRefresh?: boolean;
    } = {},
  ): Promise<{
    repositories: StarredRepository[];
    totalLoaded: number;
  }> {
    const {
      onProgress,
      batchSize = 100,
    } = options;

    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

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

      return {
        repositories: allRepositories,
        totalLoaded,
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
          let aValue: string | number, bValue: string | number;

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
  private handleError(error: unknown, message: string): GitHubError {
    const gitHubError: GitHubError = {
      message: `${message}: ${error instanceof Error ? error.message : "未知错误"}`,
    };

    if (error && typeof error === 'object' && 'status' in error) {
      gitHubError.status = (error as any).status;
    }

    console.error(gitHubError.message, error);
    return gitHubError;
  }

  /**
   * 初始化 Chroma 数据库
   */
  async initializeDatabase(): Promise<void> {
    try {
      await lancedbService.initialize();
      console.log('ChromaDB 数据库初始化成功');
    } catch (error) {
      console.error('ChromaDB 数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 同步仓库数据到 Chroma 数据库
   */
  async syncRepositoriesToDatabase(repositories: GitHubRepository[]): Promise<void> {
    try {
      await lancedbService.upsertRepositories(repositories);
      console.log(`已同步 ${repositories.length} 个仓库到向量数据库`);
    } catch (error) {
      console.error('同步仓库到数据库失败:', error);
      throw error;
    }
  }

  /**
   * 从数据库获取所有仓库
   */
  async getRepositoriesFromDatabase(limit?: number, offset?: number): Promise<GitHubRepository[]> {
    try {
      return await lancedbService.getAllRepositories(limit, offset);
    } catch (error) {
      console.error('从数据库获取仓库失败:', error);
      throw error;
    }
  }

  /**
   * 语义搜索仓库（基于向量相似度）
   */
  async searchRepositoriesSemanticially(
    query: string,
    limit: number = 10,
    filters?: {
      language?: string;
      minStars?: number;
      maxStars?: number;
    }
  ): Promise<SearchResult<GitHubRepository>> {
    try {
      const where: any = {};

      if (filters?.language) {
        where.language = filters.language;
      }

      if (filters?.minStars !== undefined || filters?.maxStars !== undefined) {
        where.stargazers_count = {};
        if (filters.minStars !== undefined) {
          where.stargazers_count["$gte"] = filters.minStars;
        }
        if (filters.maxStars !== undefined) {
          where.stargazers_count["$lte"] = filters.maxStars;
        }
      }

      return await lancedbService.searchRepositories(query, limit, where);
    } catch (error) {
      console.error('语义搜索仓库失败:', error);
      throw error;
    }
  }

  /**
   * 根据编程语言获取仓库
   */
  async getRepositoriesByLanguageFromDatabase(language: string, limit?: number): Promise<GitHubRepository[]> {
    try {
      return await lancedbService.getRepositoriesByLanguage(language, limit);
    } catch (error) {
      console.error('从数据库按语言获取仓库失败:', error);
      throw error;
    }
  }

  /**
   * 根据 Star 数量范围获取仓库
   */
  async getRepositoriesByStarRangeFromDatabase(
    minStars: number,
    maxStars: number,
    limit?: number
  ): Promise<GitHubRepository[]> {
    try {
      return await lancedbService.getRepositoriesByStarRange(minStars, maxStars, limit);
    } catch (error) {
      console.error('从数据库按 Star 范围获取仓库失败:', error);
      throw error;
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<{
    repositoriesCount: number;
    usersCount: number;
  }> {
    try {
      return await lancedbService.getStats();
    } catch (error) {
      console.error('获取数据库统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 增强版的获取所有 starred 仓库（结合 API 和数据库）
   */
  async getAllStarredRepositoriesEnhanced(options: {
    forceRefresh?: boolean;
    useDatabase?: boolean;
    onProgress?: (loaded: number, total?: number) => void;
    batchSize?: number;
  } = {}): Promise<{
    repositories: GitHubRepository[];
    totalLoaded: number;
    fromCache: boolean;
    stats?: any;
  }> {
    const { forceRefresh = false, useDatabase = true, onProgress, batchSize = 100 } = options;

    try {
      // 初始化数据库
      if (useDatabase) {
        await this.initializeDatabase();
      }

      let repositories: GitHubRepository[] = [];
      let fromCache = false;

      // 如果不强制刷新且使用数据库，先尝试从数据库获取
      if (!forceRefresh && useDatabase) {
        try {
          const dbRepositories = await this.getRepositoriesFromDatabase();
          if (dbRepositories.length > 0) {
            repositories = dbRepositories;
            fromCache = true;
            console.log(`从数据库加载了 ${repositories.length} 个仓库`);
          }
        } catch (dbError) {
          console.warn('从数据库加载仓库失败，将从 API 获取:', dbError);
        }
      }

      // 如果数据库中没有数据或强制刷新，从 API 获取
      if (repositories.length === 0 || forceRefresh) {
        const apiResult = await this.getAllStarredRepositories({
          batchSize,
          onProgress
        });
        repositories = apiResult.repositories;
        fromCache = false;

        // 同步到数据库
        if (useDatabase && repositories.length > 0) {
          try {
            await this.syncRepositoriesToDatabase(repositories);
          } catch (syncError) {
            console.warn('同步仓库到数据库失败:', syncError);
          }
        }
      }

      // 获取统计信息
      let stats;
      if (useDatabase) {
        try {
          stats = await this.getDatabaseStats();
        } catch (statsError) {
          console.warn('获取数据库统计信息失败:', statsError);
        }
      }

      return {
        repositories,
        totalLoaded: repositories.length,
        fromCache,
        stats
      };
    } catch (error) {
      console.error('获取增强版 starred 仓库失败:', error);
      throw error;
    }
  }
}

// 导出单例实例
export const githubStarService = new GitHubStarService();
export default githubStarService;