// GitHub 服务主入口文件

import { octokitManager } from "./octokit-manager";
import { enhancedGitHubAuthService } from "./enhanced-auth-service";
import { githubStarService } from "./star-service";

export { octokitManager, OctokitManager } from "./octokit-manager";
export { enhancedGitHubAuthService, EnhancedGitHubAuthService } from "./enhanced-auth-service";
export { githubStarService, GitHubStarService } from "./star-service";

// 导出类型
export type * from "./types";

// GitHub 服务管理器
export class GitHubServiceManager {
  private static instance: GitHubServiceManager;

  private constructor() {}

  static getInstance(): GitHubServiceManager {
    if (!GitHubServiceManager.instance) {
      GitHubServiceManager.instance = new GitHubServiceManager();
    }
    return GitHubServiceManager.instance;
  }

  /**
   * 获取认证服务
   */
  getAuthService() {
    return enhancedGitHubAuthService;
  }

  /**
   * 获取 Star 服务
   */
  getStarService() {
    return githubStarService;
  }

  /**
   * 获取 Octokit 管理器
   */
  getOctokitManager() {
    return octokitManager;
  }

  /**
   * 初始化所有服务
   */
  async initialize() {
    console.log("GitHub 服务管理器初始化完成");
  }

  /**
   * 清理所有服务
   */
  async cleanup() {
    octokitManager.reset();
    await enhancedGitHubAuthService.clearAuth();
    console.log("GitHub 服务管理器已清理");
  }
}

// 导出单例实例
export const githubServiceManager = GitHubServiceManager.getInstance();