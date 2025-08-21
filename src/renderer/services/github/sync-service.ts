import { githubStarService } from "./star-service";
import { githubAuthService } from "./auth-service";
import type {
  StarredRepository,
  SyncStatus,
  StarOperation,
  SyncEvent,
  GitHubRepository,
} from "./types";

/**
 * GitHub Star数据同步服务
 * 负责增量同步、实时操作和数据一致性管理
 */
export class GitHubSyncService {
  private syncStatus: SyncStatus = {
    isRunning: false,
  };

  private pendingOperations: StarOperation[] = [];
  private eventListeners: Array<(event: SyncEvent) => void> = [];
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncTime: Date | null = null;

  /**
   * 开始增量同步
   */
  async startIncrementalSync(
    options: {
      interval?: number; // 同步间隔（毫秒），默认5分钟
      batchSize?: number; // 每批处理的仓库数量
      force?: boolean; // 强制重新启动同步
    } = {},
  ): Promise<void> {
    const {
      interval = 5 * 60 * 1000,
      batchSize = 100,
      force = false,
    } = options;

    if (this.syncStatus.isRunning) {
      if (force) {
        // 强制重新启动：先停止当前同步
        this.stopSync();
      } else {
        // 同步已在运行，直接返回
        console.log("同步服务已在运行中，跳过启动");
        return;
      }
    }

    // 检查认证状态
    if (!githubAuthService.isAuthenticated()) {
      throw new Error("用户未认证，无法开始同步");
    }

    this.syncStatus = {
      isRunning: true,
      lastSync: this.lastSyncTime || undefined,
      totalRepositories: 0,
      syncedRepositories: 0,
      errors: [],
    };

    this.emitEvent({
      type: "sync_start",
      data: { status: this.syncStatus },
      timestamp: Date.now(),
    });

    try {
      // 执行初始同步
      await this.performFullSync(batchSize);

      // 设置定期增量同步
      this.syncInterval = setInterval(async () => {
        try {
          await this.performIncrementalSync(batchSize);
        } catch (error) {
          console.error("增量同步失败:", error);
          this.handleSyncError(error as Error);
        }
      }, interval);
    } catch (error) {
      this.syncStatus.isRunning = false;
      this.handleSyncError(error as Error);
      throw error;
    }
  }

  /**
   * 停止同步
   */
  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.syncStatus.isRunning = false;
    this.emitEvent({
      type: "sync_complete",
      data: { status: this.syncStatus },
      timestamp: Date.now(),
    });
  }

  /**
   * 执行完整同步
   */
  private async performFullSync(batchSize: number): Promise<void> {
    let page = 1;
    let totalSynced = 0;
    const allRepositories: StarredRepository[] = [];

    while (true) {
      const { repositories, pagination } =
        await githubStarService.getStarredRepositories({
          per_page: batchSize,
          page,
          sort: "created",
          direction: "desc",
        });

      allRepositories.push(...repositories);
      totalSynced += repositories.length;

      this.syncStatus.totalRepositories = totalSynced;
      this.syncStatus.syncedRepositories = totalSynced;

      this.emitEvent({
        type: "sync_progress",
        data: { status: this.syncStatus },
        timestamp: Date.now(),
      });

      if (!pagination.has_next_page) {
        break;
      }
      page++;
    }

    // 存储到本地缓存
    await this.storeRepositories(allRepositories);
    this.lastSyncTime = new Date();
    this.syncStatus.lastSync = this.lastSyncTime;
  }

  /**
   * 执行增量同步
   */
  private async performIncrementalSync(batchSize: number): Promise<void> {
    if (!this.lastSyncTime) {
      // 如果没有上次同步时间，执行完整同步
      await this.performFullSync(batchSize);
      return;
    }

    // 获取最近的收藏仓库（按创建时间倒序）
    const { repositories } = await githubStarService.getStarredRepositories({
      per_page: batchSize,
      page: 1,
      sort: "created",
      direction: "desc",
    });

    // 过滤出上次同步后新增的仓库
    const newRepositories = repositories.filter(
      (repo) => new Date(repo.starred_at) > this.lastSyncTime!,
    );

    if (newRepositories.length > 0) {
      await this.storeRepositories(newRepositories);

      this.syncStatus.syncedRepositories =
        (this.syncStatus.syncedRepositories || 0) + newRepositories.length;
      this.emitEvent({
        type: "sync_progress",
        data: { status: this.syncStatus },
        timestamp: Date.now(),
      });
    }

    // 处理待处理的操作
    await this.processPendingOperations();

    this.lastSyncTime = new Date();
    this.syncStatus.lastSync = this.lastSyncTime;
  }

  /**
   * 实时Star操作
   */
  async starRepository(owner: string, repo: string): Promise<void> {
    try {
      await githubStarService.starRepository(owner, repo);

      // 记录操作
      this.addPendingOperation({
        type: "star",
        owner,
        repo,
        timestamp: Date.now(),
      });

      // 立即更新本地缓存
      await this.updateLocalRepository(owner, repo, true);
    } catch (error) {
      console.error(`Star仓库失败: ${owner}/${repo}`, error);
      throw error;
    }
  }

  /**
   * 实时Unstar操作
   */
  async unstarRepository(owner: string, repo: string): Promise<void> {
    try {
      await githubStarService.unstarRepository(owner, repo);

      // 记录操作
      this.addPendingOperation({
        type: "unstar",
        owner,
        repo,
        timestamp: Date.now(),
      });

      // 立即更新本地缓存
      await this.updateLocalRepository(owner, repo, false);
    } catch (error) {
      console.error(`Unstar仓库失败: ${owner}/${repo}`, error);
      throw error;
    }
  }

  /**
   * 批量Star操作
   */
  async starMultipleRepositories(
    repositories: Array<{ owner: string; repo: string }>,
  ): Promise<
    Array<{ owner: string; repo: string; success: boolean; error?: string }>
  > {
    const results =
      await githubStarService.starMultipleRepositories(repositories);

    // 记录成功的操作
    results.forEach((result) => {
      if (result.success) {
        this.addPendingOperation({
          type: "star",
          owner: result.owner,
          repo: result.repo,
          timestamp: Date.now(),
        });
      }
    });

    return results;
  }

  /**
   * 批量Unstar操作
   */
  async unstarMultipleRepositories(
    repositories: Array<{ owner: string; repo: string }>,
  ): Promise<
    Array<{ owner: string; repo: string; success: boolean; error?: string }>
  > {
    const results =
      await githubStarService.unstarMultipleRepositories(repositories);

    // 记录成功的操作
    results.forEach((result) => {
      if (result.success) {
        this.addPendingOperation({
          type: "unstar",
          owner: result.owner,
          repo: result.repo,
          timestamp: Date.now(),
        });
      }
    });

    return results;
  }

  /**
   * 获取同步状态
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * 添加事件监听器
   */
  addEventListener(listener: (event: SyncEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: (event: SyncEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * 获取待处理操作
   */
  getPendingOperations(): StarOperation[] {
    return [...this.pendingOperations];
  }

  /**
   * 清除待处理操作
   */
  clearPendingOperations(): void {
    this.pendingOperations = [];
  }

  // 私有方法

  private addPendingOperation(operation: StarOperation): void {
    this.pendingOperations.push(operation);

    // 限制待处理操作数量，避免内存泄漏
    if (this.pendingOperations.length > 1000) {
      this.pendingOperations = this.pendingOperations.slice(-500);
    }
  }

  private async processPendingOperations(): Promise<void> {
    // 这里可以实现更复杂的操作处理逻辑
    // 比如验证操作是否成功、处理冲突等

    // 简单实现：清理超过24小时的操作
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.pendingOperations = this.pendingOperations.filter(
      (op) => op.timestamp > oneDayAgo,
    );
  }

  private async storeRepositories(
    repositories: StarredRepository[],
  ): Promise<void> {
    // 这里应该实现本地存储逻辑
    // 可以使用IndexedDB或其他存储方案
    console.log(`存储 ${repositories.length} 个仓库到本地缓存`);

    // TODO: 实现实际的存储逻辑
  }

  private async updateLocalRepository(
    owner: string,
    repo: string,
    isStarred: boolean,
  ): Promise<void> {
    // 这里应该实现本地仓库状态更新逻辑
    console.log(
      `更新本地仓库状态: ${owner}/${repo} -> ${isStarred ? "starred" : "unstarred"}`,
    );

    // TODO: 实现实际的更新逻辑
  }

  private emitEvent(event: SyncEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("事件监听器执行失败:", error);
      }
    });
  }

  private handleSyncError(error: Error): void {
    if (!this.syncStatus.errors) {
      this.syncStatus.errors = [];
    }

    this.syncStatus.errors.push(error.message);

    this.emitEvent({
      type: "sync_error",
      data: {
        status: this.syncStatus,
        error: error.message,
      },
      timestamp: Date.now(),
    });
  }
}

// 导出单例实例
export const githubSyncService = new GitHubSyncService();
export default githubSyncService;
