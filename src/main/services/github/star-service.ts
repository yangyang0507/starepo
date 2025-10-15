import { octokitManager } from "./octokit-manager";
import { lancedbService } from "../database/lancedb-service";
import { lancedbSearchService } from "../search";
import { getLogger } from "../../utils/logger";
import type {
  GitHubRepository,
  GitHubError,
  PaginationInfo,
  StarredRepository,
  GitHubAPIStarredItem,
} from "./types";
import type { SearchResult } from "../database/types";

/**
 * GitHub Star 服务类
 * 专门处理仓库收藏相关的 API 操作
 */
export class GitHubStarService {
  private readonly log = getLogger('github:star-service');

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

      const repositories: StarredRepository[] = data.map((item: GitHubAPIStarredItem) => ({
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

      const repositories: GitHubRepository[] = data.map((repo: GitHubRepository) =>
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
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'status' in error && (error as { status?: number }).status === 404) {
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
        this.log.warn(`检查仓库 ${owner}/${repo} 收藏状态失败`, error);
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
      } catch (error: unknown) {
        this.log.warn(`收藏仓库 ${owner}/${repo} 失败`, error);
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
      } catch (error: unknown) {
        this.log.warn(`取消收藏仓库 ${owner}/${repo} 失败`, error);
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

      this.log.debug("从 GitHub API 获取仓库数据");
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
          this.log.warn(`获取第 ${page} 页收藏仓库数据失败`, error);
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
    basic: {
      total_count: number;
      languages: Record<string, number>;
      topics: Record<string, number>;
      most_starred: GitHubRepository | null;
      recently_starred: GitHubRepository | null;
    };
    timeSeries: {
      monthly: Array<{date: string; count: number; cumulative: number}>;
      weekly: Array<{date: string; count: number; cumulative: number}>;
    };
    insights: {
      avgStarsPerMonth: number;
      mostActiveMonth: string;
      topLanguages: Array<{name: string; count: number; percentage: number}>;
      topTopics: Array<{name: string; count: number; percentage: number}>;
    };
  }> {
    try {
      this.log.info('[统计服务] 开始获取所有收藏仓库数据进行统计');
      
      // 优先从数据库获取所有数据，这样更高效
      let repositories: GitHubRepository[];
      try {
        // 首先尝试从数据库获取
        repositories = await this.getRepositoriesFromDatabase();
        this.log.debug('[统计服务] 从数据库获取仓库数据', { count: repositories.length });
        
        // 如果数据库中数据较少，尝试从API获取全部数据
        if (repositories.length < 1000) {
          this.log.info('[统计服务] 数据库数据较少，准备从 GitHub API 获取完整数据');
          const apiResult = await this.getAllStarredRepositories({
            batchSize: 100,
          });
          repositories = apiResult.repositories as GitHubRepository[];
          
          // 同步到数据库以便后续使用
          try {
            await this.syncRepositoriesToDatabase(repositories);
            this.log.info('[统计服务] 已将仓库数据同步到向量数据库', { count: repositories.length });
          } catch (syncError) {
            this.log.warn('[统计服务] 同步到向量数据库失败', syncError);
          }
        }
      } catch (dbError) {
        this.log.warn('[统计服务] 从数据库获取失败，尝试从 GitHub API 获取', dbError);
        // 如果数据库失败，则从API获取所有数据
        const apiResult = await this.getAllStarredRepositories({
          batchSize: 100,
        });
        repositories = apiResult.repositories as GitHubRepository[];
        this.log.info('[统计服务] 从 GitHub API 获取仓库数据', { count: repositories.length });
        
        // 尝试将API数据同步到数据库
        try {
          await this.initializeDatabase();
          await this.syncRepositoriesToDatabase(repositories);
          this.log.info('[统计服务] 已将仓库数据同步到向量数据库', { count: repositories.length });
        } catch (syncError) {
          this.log.warn('[统计服务] 同步到向量数据库失败', syncError);
        }
      }

      const languages: Record<string, number> = {};
      const topics: Record<string, number> = {};
      let mostStarred: GitHubRepository | null = null;
      let recentlyStarred: GitHubRepository | null = null;

      // 按月份统计
      const monthlyStars: Record<string, number> = {};
      let cumulative = 0;
      const monthlyData: Array<{date: string; count: number; cumulative: number}> = [];

      repositories.forEach((repo) => {
        // 统计语言
        if (repo.language) {
          languages[repo.language] = (languages[repo.language] || 0) + 1;
        }

        // 统计主题
        if (repo.topics && Array.isArray(repo.topics)) {
          repo.topics.forEach((topic: string) => {
            topics[topic] = (topics[topic] || 0) + 1;
          });
        }

        // 找到最多星标的仓库
        if (!mostStarred || repo.stargazers_count > mostStarred.stargazers_count) {
          mostStarred = repo;
        }

        // 最近收藏的仓库（第一个，因为默认按创建时间倒序）
        if (!recentlyStarred) {
          recentlyStarred = repo;
        }

        // 按月份统计（使用 starred_at 或 created_at）
        const starredAt = (repo as any).starred_at || repo.created_at;
        const date = new Date(starredAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyStars[monthKey] = (monthlyStars[monthKey] || 0) + 1;
      });

      // 生成月度数据
      const sortedMonths = Object.keys(monthlyStars).sort();
      sortedMonths.forEach(month => {
        cumulative += monthlyStars[month];
        monthlyData.push({
          date: month,
          count: monthlyStars[month],
          cumulative
        });
      });

      // 计算洞察数据
      const totalRepos = repositories.length;
      const sortedLanguageEntries = Object.entries(languages).sort(([,a], [,b]) => b - a);
      const topLanguages = sortedLanguageEntries.slice(0, 5).map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalRepos) * 100)
      }));

      const sortedTopicEntries = Object.entries(topics).sort(([,a], [,b]) => b - a);
      const topTopics = sortedTopicEntries.slice(0, 5).map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalRepos) * 100)
      }));

      // 计算月平均收藏数
      const avgStarsPerMonth = monthlyData.length > 0 
        ? totalRepos / Math.max(monthlyData.length, 12) 
        : 0;

      // 找到最活跃月份
      const mostActiveMonth = monthlyData.length > 0
        ? monthlyData.reduce((prev, current) => prev.count > current.count ? prev : current).date
        : '';

      this.log.info('[统计服务] 统计分析完成', {
        total: totalRepos,
        languageCount: Object.keys(languages).length,
        topicCount: Object.keys(topics).length
      });
      this.log.debug('[统计服务] 前五语言', topLanguages.map(l => `${l.name}(${l.count})`).join(', '));
      this.log.debug('[统计服务] 前五主题', topTopics.map(t => `${t.name}(${t.count})`).join(', '));

      return {
        basic: {
          total_count: totalRepos,
          languages,
          topics,
          most_starred: mostStarred,
          recently_starred: recentlyStarred,
        },
        timeSeries: {
          monthly: monthlyData,
          weekly: [] // 暂时留空，可后续实现
        },
        insights: {
          avgStarsPerMonth: Math.round(avgStarsPerMonth * 10) / 10,
          mostActiveMonth,
          topLanguages,
          topTopics,
        },
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
  private mapToGitHubRepository(repo: GitHubRepository | GitHubAPIStarredItem): GitHubRepository {
    // 处理 GitHubAPIStarredItem 类型
    if ('repo' in repo) {
      const starredItem = repo as GitHubAPIStarredItem;
      return {
        id: starredItem.repo.id,
        name: starredItem.repo.name,
        full_name: starredItem.repo.full_name,
        description: starredItem.repo.description,
        html_url: starredItem.repo.html_url,
        clone_url: starredItem.repo.clone_url,
        ssh_url: starredItem.repo.ssh_url,
        language: starredItem.repo.language,
        stargazers_count: starredItem.repo.stargazers_count,
        watchers_count: starredItem.repo.watchers_count,
        forks_count: starredItem.repo.forks_count,
        open_issues_count: starredItem.repo.open_issues_count,
        created_at: starredItem.repo.created_at,
        updated_at: starredItem.repo.updated_at,
        pushed_at: starredItem.repo.pushed_at,
        size: starredItem.repo.size,
        default_branch: starredItem.repo.default_branch,
        topics: starredItem.repo.topics || [],
        archived: starredItem.repo.archived,
        disabled: starredItem.repo.disabled,
        private: starredItem.repo.private,
        fork: starredItem.repo.fork,
        owner: {
          id: starredItem.repo.owner.id,
          login: starredItem.repo.owner.login,
          avatar_url: starredItem.repo.owner.avatar_url,
        },
      };
    }
    
    // 处理 GitHubRepository 类型
    return repo as GitHubRepository;
  }

  /**
   * 错误处理
   */
  private handleError(error: unknown, message: string): GitHubError {
    const gitHubError: GitHubError = {
      message: `${message}: ${error instanceof Error ? error.message : "未知错误"}`,
    };

    if (error && typeof error === 'object' && 'status' in error) {
      gitHubError.status = (error as { status?: number }).status;
    }

    this.log.error(gitHubError.message, error);
    return gitHubError;
  }

  /**
   * 初始化 LanceDB 数据库
   */
  async initializeDatabase(): Promise<void> {
    try {
      await lancedbService.initialize();
      this.log.info('LanceDB 数据库初始化成功');
    } catch (error) {
      this.log.error('LanceDB 数据库初始化失败', error);
      throw error;
    }
  }

  /**
   * 同步仓库数据到 LanceDB 数据库
   */
  async syncRepositoriesToDatabase(repositories: GitHubRepository[]): Promise<void> {
    try {
      await lancedbService.upsertRepositories(repositories);
      this.log.info('已同步仓库到向量数据库', { count: repositories.length });
      lancedbSearchService.clearCache();
    } catch (error) {
      this.log.error('同步仓库到数据库失败', error);
      throw error;
    }
  }

  /**
   * 从数据库获取所有仓库
   */
  async getRepositoriesFromDatabase(limit?: number, offset?: number): Promise<GitHubRepository[]> {
    try {
      // 确保 LanceDB 在访问前已完成初始化
      await this.initializeDatabase();
      return await lancedbService.getAllRepositories(limit, offset);
    } catch (error) {
      this.log.error('从数据库获取仓库失败', error);
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
      const conditions: string[] = [];

      if (filters?.language) {
        conditions.push(`language = '${this.escapeSqlLiteral(filters.language)}'`);
      }

      const minInput = filters?.minStars;
      const maxInput = filters?.maxStars;
      const hasMin = typeof minInput === 'number' && Number.isFinite(minInput);
      const hasMax = typeof maxInput === 'number' && Number.isFinite(maxInput);

      if (hasMin || hasMax) {
        const min = hasMin ? Math.max(0, Math.floor(minInput as number)) : 0;
        const maxCandidate = hasMax ? Math.floor(maxInput as number) : Number.MAX_SAFE_INTEGER;
        const max = Math.max(min, maxCandidate);
        conditions.push(`stargazers_count >= ${min} AND stargazers_count <= ${max}`);
      }

      const whereClause = conditions.length ? conditions.join(' AND ') : undefined;

      return await lancedbService.searchRepositories(query, limit, whereClause);
    } catch (error) {
      this.log.error('语义搜索仓库失败', error);
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
      this.log.error('从数据库按语言获取仓库失败', error);
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
      this.log.error('从数据库按 Star 范围获取仓库失败', error);
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
      this.log.error('获取数据库统计信息失败', error);
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
    stats?: Record<string, unknown>;
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
            this.log.debug('从向量数据库加载仓库数据', { count: repositories.length });
          }
        } catch (dbError) {
          this.log.warn('从向量数据库加载仓库失败，改用 GitHub API', dbError);
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
            this.log.warn('同步仓库到向量数据库失败', syncError);
          }
        }
      }

      // 获取统计信息
      let stats;
      if (useDatabase) {
        try {
          stats = await this.getDatabaseStats();
        } catch (statsError) {
          this.log.warn('获取数据库统计信息失败', statsError);
        }
      }

      return {
        repositories,
        totalLoaded: repositories.length,
        fromCache,
        stats
      };
    } catch (error) {
      this.log.error('获取增强版 starred 仓库失败', error);
      throw error;
    }
  }

  private escapeSqlLiteral(value: string): string {
    return value.replace(/'/g, "''");
  }
}

// 导出单例实例
export const githubStarService = new GitHubStarService();
export default githubStarService;
