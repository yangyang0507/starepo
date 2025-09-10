import { octokitManager } from "./octokit-manager";
import type { GitHubUser, GitHubError, PaginationInfo, GitHubAPIUser } from "./types";

/**
 * GitHub 用户服务类
 * 提供用户相关的 API 操作
 */
export class GitHubUserService {
  /**
   * 获取当前认证用户信息
   */
  async getCurrentUser(): Promise<GitHubUser> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      const { data } = await octokit.rest.users.getAuthenticated();

      return {
        id: data.id,
        login: data.login,
        name: data.name,
        email: data.email,
        avatar_url: data.avatar_url,
        html_url: data.html_url,
        bio: data.bio,
        company: data.company,
        location: data.location,
        blog: data.blog,
        public_repos: data.public_repos,
        public_gists: data.public_gists,
        followers: data.followers,
        following: data.following,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (error) {
      throw this.handleError(error, "获取用户信息失败");
    }
  }

  /**
   * 根据用户名获取用户信息
   */
  async getUserByUsername(username: string): Promise<GitHubUser> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      const { data } = await octokit.rest.users.getByUsername({
        username,
      });

      return {
        id: data.id,
        login: data.login,
        name: data.name,
        email: data.email,
        avatar_url: data.avatar_url,
        html_url: data.html_url,
        bio: data.bio,
        company: data.company,
        location: data.location,
        blog: data.blog,
        public_repos: data.public_repos,
        public_gists: data.public_gists,
        followers: data.followers,
        following: data.following,
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    } catch (error) {
      throw this.handleError(error, `获取用户 ${username} 信息失败`);
    }
  }

  /**
   * 搜索用户
   */
  async searchUsers(
    query: string,
    options: {
      sort?: "followers" | "repositories" | "joined";
      order?: "asc" | "desc";
      per_page?: number;
      page?: number;
    } = {},
  ): Promise<{
    users: GitHubUser[];
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
        sort = "followers",
        order = "desc",
        per_page = 30,
        page = 1,
      } = options;

      const { data } = await octokit.rest.search.users({
        q: query,
        sort,
        order,
        per_page,
        page,
      });

      const users: GitHubUser[] = data.items.map((item: GitHubAPIUser) => ({
        id: item.id,
        login: item.login,
        name: item.name || null,
        email: item.email || null,
        avatar_url: item.avatar_url,
        html_url: item.html_url,
        bio: null, // Search API doesn't return bio
        company: null, // Search API doesn't return company
        location: null, // Search API doesn't return location
        blog: null, // Search API doesn't return blog
        public_repos: 0, // Search API doesn't return public_repos
        public_gists: 0, // Search API doesn't return public_gists
        followers: 0, // Search API doesn't return followers
        following: 0, // Search API doesn't return following
        created_at: "", // Search API doesn't return created_at
        updated_at: "", // Search API doesn't return updated_at
      }));

      const pagination: PaginationInfo = {
        page,
        per_page,
        total_count: data.total_count,
        has_next_page:
          data.items.length === per_page && page * per_page < data.total_count,
        has_prev_page: page > 1,
      };

      return {
        users,
        total_count: data.total_count,
        incomplete_results: data.incomplete_results,
        pagination,
      };
    } catch (error) {
      throw this.handleError(error, "搜索用户失败");
    }
  }

  /**
   * 获取用户的关注者列表
   */
  async getUserFollowers(
    username: string,
    options: {
      per_page?: number;
      page?: number;
    } = {},
  ): Promise<{
    followers: GitHubUser[];
    pagination: PaginationInfo;
  }> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      const { per_page = 30, page = 1 } = options;

      const { data } = await octokit.rest.users.listFollowersForUser({
        username,
        per_page,
        page,
      });

      const followers: GitHubUser[] = data.map((item: GitHubAPIUser) => ({
        id: item.id,
        login: item.login,
        name: item.name || null,
        email: item.email || null,
        avatar_url: item.avatar_url,
        html_url: item.html_url,
        bio: null, // Followers API doesn't return detailed info
        company: null,
        location: null,
        blog: null,
        public_repos: 0,
        public_gists: 0,
        followers: 0,
        following: 0,
        created_at: "",
        updated_at: "",
      }));

      const pagination: PaginationInfo = {
        page,
        per_page,
        has_next_page: data.length === per_page,
        has_prev_page: page > 1,
      };

      return {
        followers,
        pagination,
      };
    } catch (error) {
      throw this.handleError(error, `获取用户 ${username} 的关注者失败`);
    }
  }

  /**
   * 获取用户的关注列表
   */
  async getUserFollowing(
    username: string,
    options: {
      per_page?: number;
      page?: number;
    } = {},
  ): Promise<{
    following: GitHubUser[];
    pagination: PaginationInfo;
  }> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      const { per_page = 30, page = 1 } = options;

      const { data } = await octokit.rest.users.listFollowingForUser({
        username,
        per_page,
        page,
      });

      const following: GitHubUser[] = data.map((item: GitHubAPIUser) => ({
        id: item.id,
        login: item.login,
        name: item.name || null,
        email: item.email || null,
        avatar_url: item.avatar_url,
        html_url: item.html_url,
        bio: null, // Following API doesn't return detailed info
        company: null,
        location: null,
        blog: null,
        public_repos: 0,
        public_gists: 0,
        followers: 0,
        following: 0,
        created_at: "",
        updated_at: "",
      }));

      const pagination: PaginationInfo = {
        page,
        per_page,
        has_next_page: data.length === per_page,
        has_prev_page: page > 1,
      };

      return {
        following,
        pagination,
      };
    } catch (error) {
      throw this.handleError(error, `获取用户 ${username} 的关注列表失败`);
    }
  }

  /**
   * 检查是否关注某个用户
   */
  async checkIfFollowingUser(username: string): Promise<boolean> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      try {
        await octokit.rest.users.checkPersonIsFollowedByAuthenticated({
          username,
        });
        return true;
      } catch (error: unknown) {
        if (error.status === 404) {
          return false;
        }
        throw error;
      }
    } catch (error) {
      throw this.handleError(error, `检查是否关注用户 ${username} 失败`);
    }
  }

  /**
   * 关注用户
   */
  async followUser(username: string): Promise<void> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      await octokit.rest.users.follow({
        username,
      });
    } catch (error) {
      throw this.handleError(error, `关注用户 ${username} 失败`);
    }
  }

  /**
   * 取消关注用户
   */
  async unfollowUser(username: string): Promise<void> {
    try {
      const octokit = octokitManager.getOctokit();
      if (!octokit) {
        throw new Error("GitHub客户端未初始化，请先进行认证");
      }

      await octokit.rest.users.unfollow({
        username,
      });
    } catch (error) {
      throw this.handleError(error, `取消关注用户 ${username} 失败`);
    }
  }

  /**
   * 错误处理
   */
  private handleError(error: unknown, message: string): GitHubError {
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
export const githubUserService = new GitHubUserService();
export default githubUserService;
