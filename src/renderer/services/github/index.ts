// GitHub服务层统一导出
export { GitHubAuthService, githubAuthService } from "./auth-service";
export { GitHubUserService, githubUserService } from "./user-service";
export {
  GitHubRepositoryService,
  githubRepositoryService,
} from "./repository-service";
export { GitHubStarService, githubStarService } from "./star-service";
export { OctokitManager, octokitManager } from "./octokit-manager";
export { GitHubSyncService } from "./sync-service";
export { GitHubStorageService } from "./storage-service";
export { GitHubRateLimitService } from "./rate-limit-service";
export { GitHubCacheService } from "./cache-service";

// 类型定义导出
export * from "./types";

// 导入服务实例用于创建默认导出
import { githubAuthService } from "./auth-service";
import { githubUserService } from "./user-service";
import { githubRepositoryService } from "./repository-service";
import { githubStarService } from "./star-service";
import { octokitManager } from "./octokit-manager";
import { GitHubSyncService } from "./sync-service";
import { GitHubStorageService } from "./storage-service";
import { GitHubRateLimitService } from "./rate-limit-service";
import { GitHubCacheService } from "./cache-service";

// 创建服务实例
const githubStorageService = new GitHubStorageService();
const githubSyncService = new GitHubSyncService();
const githubRateLimitService = new GitHubRateLimitService();
const githubCacheService = new GitHubCacheService();

// 默认服务实例
export const githubServices = {
  auth: githubAuthService,
  user: githubUserService,
  repository: githubRepositoryService,
  star: githubStarService,
  octokit: octokitManager,
  storage: githubStorageService,
  sync: githubSyncService,
  rateLimit: githubRateLimitService,
  cache: githubCacheService,
} as const;

export default githubServices;
