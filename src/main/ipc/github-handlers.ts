import { ipcMain } from "electron";
import { IPC_CHANNELS } from "@shared/constants/ipc-channels";
import { githubServiceManager } from "../services/github";
import type { APIResponse, GitHubPaginationOptions, GitHubSearchOptions } from "@shared/types";
import { getLogger } from "../utils/logger";
import { serializeDates } from "../utils/serialize";

/**
 * GitHub 相关的 IPC 处理器
 */
export function registerGitHubHandlers(): void {
  const githubLogger = getLogger("ipc:github");
  const authService = githubServiceManager.getAuthService();
  const starService = githubServiceManager.getStarService();

  // ============= 认证相关 =============

  // 使用 Token 认证
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.AUTHENTICATE_WITH_TOKEN,
    async (_, token: string): Promise<APIResponse> => {
      try {
        const result = await authService.authenticateWithToken(token);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "认证失败",
        };
      }
    }
  );

  // 验证 Token
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.VALIDATE_TOKEN,
    async (_, token: string): Promise<APIResponse> => {
      try {
        const result = await authService.validateToken(token);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Token 验证失败",
        };
      }
    }
  );

  // 获取认证状态
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.GET_AUTH_STATE,
    async (): Promise<APIResponse> => {
      try {
        const authState = await authService.getAuthState();
        githubLogger.debug("[主进程] 获取到的原始认证状态", authState);
        githubLogger.debug("[主进程] 获取认证状态", {
          isAuthenticated: authState.isAuthenticated,
          user: authState.user?.login,
          hasTokenInfo: !!authState.tokenInfo,
        });
        
        // 安全地序列化所有日期字段，统一为字符串格式
        const serializedAuthState = serializeDates(authState);
        githubLogger.debug("[主进程] 认证状态序列化完成");

        return {
          success: true,
          data: serializedAuthState,
        };
      } catch (error) {
        githubLogger.error("[主进程] 获取认证状态失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "获取认证状态失败",
        };
      }
    }
  );

  // 刷新认证
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.REFRESH_AUTH,
    async (): Promise<APIResponse> => {
      try {
        const result = await authService.refreshAuth();
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "刷新认证失败",
        };
      }
    }
  );

  // 清除认证
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.CLEAR_AUTH,
    async (): Promise<APIResponse> => {
      try {
        await authService.clearAuth();
        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "清除认证失败",
        };
      }
    }
  );

  // ============= 用户相关 =============

  // 获取当前用户
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.GET_CURRENT_USER,
    async (): Promise<APIResponse> => {
      try {
        githubLogger.debug("[主进程] 开始获取当前用户信息");
        const user = authService.getCurrentUserSync();
        githubLogger.debug("[主进程] 获取到的用户信息", {
          user: user ? `${user.login} (${user.name})` : "null/undefined",
        });
        return {
          success: true,
          data: user,
        };
      } catch (error) {
        githubLogger.error("[主进程] 获取用户信息失败", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "获取用户信息失败",
        };
      }
    }
  );

  // ============= Star 相关 =============

  // 获取收藏的仓库列表
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.GET_STARRED_REPOSITORIES,
    async (_, options: GitHubPaginationOptions): Promise<APIResponse> => {
      try {
        const result = await starService.getStarredRepositories(options);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "获取收藏仓库失败",
        };
      }
    }
  );

  // 获取指定用户的收藏仓库
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.GET_USER_STARRED_REPOSITORIES,
    async (_, username: string, options: GitHubPaginationOptions): Promise<APIResponse> => {
      try {
        const result = await starService.getUserStarredRepositories(username, options);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "获取用户收藏仓库失败",
        };
      }
    }
  );

  // 检查仓库是否被收藏
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.CHECK_IF_STARRED,
    async (_, owner: string, repo: string): Promise<APIResponse> => {
      try {
        const isStarred = await starService.checkIfStarred(owner, repo);
        return {
          success: true,
          data: isStarred,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "检查收藏状态失败",
        };
      }
    }
  );

  // 收藏仓库
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.STAR_REPOSITORY,
    async (_, owner: string, repo: string): Promise<APIResponse> => {
      try {
        await starService.starRepository(owner, repo);
        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "收藏仓库失败",
        };
      }
    }
  );

  // 取消收藏仓库
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.UNSTAR_REPOSITORY,
    async (_, owner: string, repo: string): Promise<APIResponse> => {
      try {
        await starService.unstarRepository(owner, repo);
        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "取消收藏失败",
        };
      }
    }
  );

  // 获取所有收藏的仓库
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.GET_ALL_STARRED_REPOSITORIES,
    async (_, options: GitHubPaginationOptions): Promise<APIResponse> => {
      try {
        // 过滤掉不可序列化的回调函数，避免 "An object could not be cloned" 错误
        const { onProgress: _onProgress, ...safeOptions } = options || {};
        const result = await starService.getAllStarredRepositories(safeOptions);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "获取所有收藏仓库失败",
        };
      }
    }
  );

  // 获取收藏仓库统计
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.GET_STARRED_STATS,
    async (): Promise<APIResponse> => {
      try {
        const stats = await starService.getStarredRepositoriesStats();
        return {
          success: true,
          data: stats,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "获取统计信息失败",
        };
      }
    }
  );

  // 搜索收藏的仓库
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.SEARCH_STARRED_REPOSITORIES,
    async (_, query: string, options: GitHubSearchOptions): Promise<APIResponse> => {
      try {
        // 转换选项以匹配 star-service 的期望类型
        const serviceOptions = {
          language: options.q, // 简化的映射，实际应用中可能需要更复杂
          topic: options.q,
          sort: options.sort !== "forks" ? options.sort : "stars", // 排除不支持的 "forks"
          direction: options.direction,
        };
        
        const result = await starService.searchStarredRepositories(query, serviceOptions);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "搜索收藏仓库失败",
        };
      }
    }
  );

  // ============= 批量操作 =============

  // 批量检查收藏状态
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.CHECK_MULTIPLE_STAR_STATUS,
    async (_, repositories: Array<{ owner: string; repo: string }>): Promise<APIResponse> => {
      try {
        const results = await starService.checkMultipleStarStatus(repositories);
        return {
          success: true,
          data: results,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "批量检查收藏状态失败",
        };
      }
    }
  );

  // 批量收藏仓库
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.STAR_MULTIPLE_REPOSITORIES,
    async (_, repositories: Array<{ owner: string; repo: string }>): Promise<APIResponse> => {
      try {
        const results = await starService.starMultipleRepositories(repositories);
        return {
          success: true,
          data: results,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "批量收藏仓库失败",
        };
      }
    }
  );

  // 批量取消收藏
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.UNSTAR_MULTIPLE_REPOSITORIES,
    async (_, repositories: Array<{ owner: string; repo: string }>): Promise<APIResponse> => {
      try {
        const results = await starService.unstarMultipleRepositories(repositories);
        return {
          success: true,
          data: results,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "批量取消收藏失败",
        };
      }
    }
  );

  // ============= 向量数据库集成 =============

  // 初始化数据库
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.INITIALIZE_DATABASE,
    async (): Promise<APIResponse> => {
      try {
        await starService.initializeDatabase();
        return {
          success: true,
          message: "数据库初始化成功",
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "数据库初始化失败",
        };
      }
    }
  );

  // 获取增强版的所有 starred 仓库
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.GET_ALL_STARRED_REPOSITORIES_ENHANCED,
    async (_, options: GitHubPaginationOptions = {}): Promise<APIResponse> => {
      try {
        // 转换选项以匹配方法的期望类型
        const serviceOptions = {
          forceRefresh: options.forceRefresh,
          useDatabase: options.useDatabase,
          onProgress: options.onProgress,
          batchSize: options.batchSize,
        };
        
        const result = await starService.getAllStarredRepositoriesEnhanced(serviceOptions);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "获取增强版 starred 仓库失败",
        };
      }
    }
  );

  // 语义搜索仓库
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.SEARCH_REPOSITORIES_SEMANTICALLY,
    async (_, query: string, limit: number = 10, filters?: { language?: string; topics?: string[]; minStars?: number; maxStars?: number }): Promise<APIResponse> => {
      try {
        const result = await starService.searchRepositoriesSemanticially(query, limit, filters);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "语义搜索仓库失败",
        };
      }
    }
  );

  // 根据编程语言从数据库获取仓库
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.GET_REPOSITORIES_BY_LANGUAGE_FROM_DB,
    async (_, language: string, limit?: number): Promise<APIResponse> => {
      try {
        const result = await starService.getRepositoriesByLanguageFromDatabase(language, limit);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "从数据库按语言获取仓库失败",
        };
      }
    }
  );

  // 根据 Star 数量范围从数据库获取仓库
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.GET_REPOSITORIES_BY_STAR_RANGE_FROM_DB,
    async (_, minStars: number, maxStars: number, limit?: number): Promise<APIResponse> => {
      try {
        const result = await starService.getRepositoriesByStarRangeFromDatabase(minStars, maxStars, limit);
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "从数据库按 Star 范围获取仓库失败",
        };
      }
    }
  );

  // 获取数据库统计信息
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.GET_DATABASE_STATS,
    async (): Promise<APIResponse> => {
      try {
        const result = await starService.getDatabaseStats();
        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "获取数据库统计信息失败",
        };
      }
    }
  );

  // 同步仓库到数据库
  ipcMain.handle(
    IPC_CHANNELS.GITHUB.SYNC_REPOSITORIES_TO_DATABASE,
    async (_, repositories: import("@shared/types").GitHubRepository[]): Promise<APIResponse> => {
      try {
        await starService.syncRepositoriesToDatabase(repositories);
        return {
          success: true,
          message: `已同步 ${repositories.length} 个仓库到数据库`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "同步仓库到数据库失败",
        };
      }
    }
  );

  githubLogger.debug("GitHub IPC 处理器已注册（包含向量数据库功能）");
}
