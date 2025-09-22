import { OctokitManager, octokitManager } from "./octokit-manager";
import { githubTokenStorageClient } from "@/services/storage/secure";
import type {
  AuthenticationResult,
  GitHubUser,
  TokenValidationResult,
  AuthState,
  GitHubClientConfig,
} from "./types";

/**
 * GitHub 认证服务类
 * 管理 Personal Access Token 认证方式
 */
export class GitHubAuthService {
  private octokitManager: OctokitManager;
  private authState: AuthState = {
    isAuthenticated: false,
    authMethod: undefined,
    user: undefined,
    token: undefined,
  };
  private authListeners: Array<(state: AuthState) => void> = [];

  constructor() {
    this.octokitManager = octokitManager;
    this.initializeAuth();
  }

  /**
   * 初始化认证状态
   */
  private async initializeAuth(): Promise<void> {
    try {
      const hasAuth = await githubTokenStorageClient.hasValidAuth();
      if (hasAuth) {
        const token = await githubTokenStorageClient.getToken();
        const authMethod = await githubTokenStorageClient.getAuthMethod();
        const user = await githubTokenStorageClient.getUserInfo();

        if (token && authMethod) {
          this.authState = {
            isAuthenticated: true,
            authMethod,
            user: user || undefined,
            token,
          };

          // 初始化 Octokit 客户端
          const config: GitHubClientConfig = {
            authMethod: authMethod || "token",
            token,
          };
          await this.octokitManager.initialize(config);
          this.notifyAuthListeners();
        }
      }
    } catch (error) {
      console.error("初始化认证状态失败:", error);
      await this.clearAuth();
    }
  }

  /**
   * 获取当前认证状态
   */
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * 检查是否已认证
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  /**
   * 获取当前用户信息
   */
  getCurrentUser(): GitHubUser | undefined {
    return this.authState.user;
  }

  /**
   * 获取当前认证方式
   */
  getAuthMethod(): "token" | undefined {
    return this.authState.authMethod;
  }

  /**
   * 使用 Personal Access Token 进行认证
   */
  async authenticateWithToken(token: string): Promise<AuthenticationResult> {
    try {
      // 验证 Token
      const validation = await this.validateToken(token);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || "Token 验证失败",
        };
      }

      // 初始化 Octokit 客户端
      const config: GitHubClientConfig = {
        authMethod: "token",
        token,
      };
      await this.octokitManager.initialize(config);

      // 获取用户信息
      const user = await this.octokitManager.getCurrentUser();
      if (!user) {
        return {
          success: false,
          error: "无法获取用户信息",
        };
      }

      // 保存认证信息
      await githubTokenStorageClient.saveToken(token, "token");
      await githubTokenStorageClient.saveUserInfo(user);

      // 更新认证状态
      this.authState = {
        isAuthenticated: true,
        authMethod: "token",
        user,
        token,
      };

      this.notifyAuthListeners();

      return {
        success: true,
        user,
      };
    } catch (error) {
      console.error("Token 认证失败:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "认证失败",
      };
    }
  }

  
  /**
   * 验证 GitHub Token
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // 创建临时的 Octokit 实例进行验证
      const tempManager = OctokitManager.getInstance();
      const config: GitHubClientConfig = {
        authMethod: "token",
        token,
      };
      await tempManager.initialize(config);

      // 尝试获取用户信息来验证 token
      const user = await tempManager.getCurrentUser();
      if (!user) {
        return {
          valid: false,
          error: "Token 无效或已过期",
        };
      }

      // 检查 token 权限
      const scopes = await this.getTokenScopes(tempManager);
      const hasRequiredScopes = this.checkRequiredScopes(scopes);

      if (!hasRequiredScopes.valid) {
        return {
          valid: false,
          error: hasRequiredScopes.error,
          scopes,
        };
      }

      return {
        valid: true,
        user,
        scopes,
      };
    } catch (error) {
      console.error("Token 验证失败:", error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Token 验证失败",
      };
    }
  }

  /**
   * 获取 Token 的权限范围
   */
  private async getTokenScopes(manager: OctokitManager): Promise<string[]> {
    try {
      const octokit = manager.getOctokit();
      if (!octokit) {
        return [];
      }
      const response = await octokit.rest.users.getAuthenticated();
      const scopes = response.headers["x-oauth-scopes"];
      return scopes ? scopes.split(", ").map((s) => s.trim()) : [];
    } catch (error) {
      console.warn("无法获取 Token 权限范围:", error);
      return [];
    }
  }

  /**
   * 检查必需的权限范围
   */
  private checkRequiredScopes(scopes: string[]): {
    valid: boolean;
    error?: string;
  } {
    const requiredScopes = ["user", "public_repo"];
    const missingScopes = requiredScopes.filter(
      (scope) => !scopes.includes(scope),
    );

    if (missingScopes.length > 0) {
      return {
        valid: false,
        error: `Token 缺少必需的权限: ${missingScopes.join(", ")}`,
      };
    }

    return { valid: true };
  }

  /**
   * 刷新认证状态
   */
  async refreshAuth(): Promise<boolean> {
    try {
      if (!this.authState.isAuthenticated || !this.authState.token) {
        return false;
      }

      // 重新验证当前 token
      const validation = await this.validateToken(this.authState.token);
      if (!validation.valid) {
        await this.clearAuth();
        return false;
      }

      // 更新用户信息
      if (validation.user) {
        this.authState.user = validation.user;
        await githubTokenStorageClient.saveUserInfo(validation.user);
        this.notifyAuthListeners();
      }

      return true;
    } catch (error) {
      console.error("刷新认证状态失败:", error);
      await this.clearAuth();
      return false;
    }
  }

  /**
   * 清除认证信息
   */
  async clearAuth(): Promise<void> {
    try {
      await githubTokenStorageClient.clearAuth();
      this.authState = {
        isAuthenticated: false,
        authMethod: undefined,
        user: undefined,
        token: undefined,
      };
      this.notifyAuthListeners();
    } catch (error) {
      console.error("清除认证信息失败:", error);
    }
  }

  /**
   * 添加认证状态监听器
   */
  addAuthListener(listener: (state: AuthState) => void): () => void {
    this.authListeners.push(listener);

    // 返回取消监听的函数
    return () => {
      const index = this.authListeners.indexOf(listener);
      if (index > -1) {
        this.authListeners.splice(index, 1);
      }
    };
  }

  /**
   * 通知所有认证状态监听器
   */
  private notifyAuthListeners(): void {
    this.authListeners.forEach((listener) => {
      try {
        listener(this.getAuthState());
      } catch (error) {
        console.error("认证状态监听器执行失败:", error);
      }
    });
  }

  /**
   * 获取 Octokit 管理器实例
   */
  getOctokitManager(): OctokitManager {
    return this.octokitManager;
  }
}

// 导出单例实例
export const githubAuthService = new GitHubAuthService();

// 默认导出
export default githubAuthService;
