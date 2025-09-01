// GitHub服务层统一导出
export { GitHubAuthService, githubAuthService } from "./auth-service";
export { GitHubUserService, githubUserService } from "./user-service";
export { GitHubStarService, githubStarService } from "./star-service";
export { OctokitManager, octokitManager } from "./octokit-manager";
export { GitHubSyncService } from "./sync-service";

// 类型定义导出
export * from "./types";

// 导入服务实例用于创建默认导出
import { githubAuthService } from "./auth-service";
import { githubUserService } from "./user-service";
import { githubStarService } from "./star-service";
import { GitHubSyncService } from "./sync-service";

// 创建服务实例
const githubSyncService = new GitHubSyncService();

// 默认服务实例
export const githubServices = {
  auth: githubAuthService,
  user: githubUserService,
  star: githubStarService,
  sync: githubSyncService,
} as const;

export default githubServices;
