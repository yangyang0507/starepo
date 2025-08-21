import { octokitManager } from "./octokit-manager";
import type {
  GitHubRepository,
  GitHubError,
  PaginationInfo,
  GitHubLanguageStats,
} from "./types";

/**
 * GitHub 仓库服务类
 * 提供仓库相关的 API 操作
 */
export class GitHubRepositoryService {
  /**
   * 获取用户的仓库列表
   */
  async getUserRepositories(
    username?: string,
    options: {
      type?: "all" | "owner" | "public" | "private" | "member";
      sort?: "created" | "updated" | "pushed" | "full_name";
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
        type = "owner",
        sort = "updated",
        direction = "desc",
        per_page = 30,
        page = 1,
      } = options;

      let data;
      if (username) {
        // 获取指定用户的公开仓库
        const response = await octokit.rest.repos.listForUser({
          username,
          sort,
          direction,
          per_page,
          page,
        });
        data = response.data;
      } else {
        // 获取当前认证用户的仓库
        const response = await octokit.rest.repos.listForAuthenticatedUser({
          type,
          sort,
          direction,
          per_page,
          page,
        });
        data = response.data;
      }

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
      throw this.handleError(error, "获取仓库列表失败");
    }
  }

  /**
   * 获取单个仓库信息
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      const { data } = await octokit.rest.repos.get({
        owner,
        repo,
      });

      return this.mapToGitHubRepository(data);
    } catch (error) {
      throw this.handleError(error, `获取仓库 ${owner}/${repo} 信息失败`);
    }
  }

  /**
   * 搜索仓库
   */
  async searchRepositories(
    query: string,
    options: {
      sort?: "stars" | "forks" | "help-wanted-issues" | "updated";
      order?: "asc" | "desc";
      per_page?: number;
      page?: number;
    } = {},
  ): Promise<{
    repositories: GitHubRepository[];
    total_count: number;
    incomplete_results: boolean;
    pagination: PaginationInfo;
  }> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      const {
        sort = "stars",
        order = "desc",
        per_page = 30,
        page = 1,
      } = options;

      const { data } = await octokit.rest.search.repos({
        q: query,
        sort,
        order,
        per_page,
        page,
      });

      const repositories: GitHubRepository[] = data.items.map((repo: any) =>
        this.mapToGitHubRepository(repo),
      );

      const pagination: PaginationInfo = {
        page,
        per_page,
        total_count: data.total_count,
        has_next_page:
          data.items.length === per_page && page * per_page < data.total_count,
        has_prev_page: page > 1,
      };

      return {
        repositories,
        total_count: data.total_count,
        incomplete_results: data.incomplete_results,
        pagination,
      };
    } catch (error) {
      throw this.handleError(error, "搜索仓库失败");
    }
  }

  /**
   * 获取仓库的语言统计
   */
  async getRepositoryLanguages(
    owner: string,
    repo: string,
  ): Promise<GitHubLanguageStats> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      const { data } = await octokit.rest.repos.listLanguages({
        owner,
        repo,
      });

      return data as GitHubLanguageStats;
    } catch (error) {
      throw this.handleError(error, `获取仓库 ${owner}/${repo} 语言统计失败`);
    }
  }

  /**
   * 获取仓库的贡献者列表
   */
  async getRepositoryContributors(
    owner: string,
    repo: string,
    options: {
      anon?: boolean;
      per_page?: number;
      page?: number;
    } = {},
  ): Promise<{
    contributors: Array<{
      login?: string;
      id?: number;
      avatar_url?: string;
      html_url?: string;
      contributions: number;
      type?: string;
    }>;
    pagination: PaginationInfo;
  }> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      const { anon = false, per_page = 30, page = 1 } = options;

      const { data } = await octokit.rest.repos.listContributors({
        owner,
        repo,
        anon: anon ? "true" : "false",
        per_page,
        page,
      });

      const contributors = data.map((contributor: any) => ({
        login: contributor.login,
        id: contributor.id,
        avatar_url: contributor.avatar_url,
        html_url: contributor.html_url,
        contributions: contributor.contributions,
        type: contributor.type,
      }));

      const pagination: PaginationInfo = {
        page,
        per_page,
        has_next_page: data.length === per_page,
        has_prev_page: page > 1,
      };

      return {
        contributors,
        pagination,
      };
    } catch (error) {
      throw this.handleError(error, `获取仓库 ${owner}/${repo} 贡献者列表失败`);
    }
  }

  /**
   * 获取仓库的README内容
   */
  async getRepositoryReadme(
    owner: string,
    repo: string,
  ): Promise<{
    content: string;
    encoding: string;
    size: number;
    name: string;
    path: string;
    sha: string;
    url: string;
    git_url: string;
    html_url: string;
    download_url: string;
  }> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      const { data } = await octokit.rest.repos.getReadme({
        owner,
        repo,
      });

      return {
        content: data.content,
        encoding: data.encoding as string,
        size: data.size,
        name: data.name,
        path: data.path,
        sha: data.sha,
        url: data.url,
        git_url: data.git_url || "",
        html_url: data.html_url || "",
        download_url: data.download_url || "",
      };
    } catch (error) {
      throw this.handleError(error, `获取仓库 ${owner}/${repo} README失败`);
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
   * 获取用户收藏的仓库列表
   */
  async getStarredRepositories(
    username?: string,
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

      let data;
      if (username) {
        // 获取指定用户的收藏仓库
        const response = await octokit.rest.activity.listReposStarredByUser({
          username,
          sort,
          direction,
          per_page,
          page,
        });
        data = response.data;
      } else {
        // 获取当前认证用户的收藏仓库
        const response =
          await octokit.rest.activity.listReposStarredByAuthenticatedUser({
            sort,
            direction,
            per_page,
            page,
          });
        data = response.data;
      }

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
      throw this.handleError(error, "获取收藏仓库列表失败");
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
export const githubRepositoryService = new GitHubRepositoryService();
export default githubRepositoryService;
