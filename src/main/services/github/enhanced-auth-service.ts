import { Octokit } from 'octokit';
import { githubTokenStorage } from '../database/secure-service';
import type {
  AuthState,
  GitHubUser,
  TokenInfo,
  AuthError,
  TokenValidationResult,
} from '@shared/types/auth';
import type { AuthenticationResult } from './types';

/**
 * 增强的GitHub认证服务
 * 支持完整的AuthState管理和持久化
 */
export class EnhancedGitHubAuthService {
  private currentAuthState: AuthState = {
    isAuthenticated: false,
  };

  private authListeners: Array<(state: AuthState) => void> = [];

  /**
   * 初始化认证服务，从存储中恢复认证状态
   */
  async initialize(): Promise<boolean> {
    try {
      // 尝试从存储中恢复认证状态
      const storedToken = await githubTokenStorage.getToken();
      if (!storedToken) {
        return false;
      }

      // 检查Token是否过期
      if (await githubTokenStorage.isExpired()) {
        await githubTokenStorage.clearAuth();
        return false;
      }

      // 尝试验证Token
      const validation = await this.validateToken(storedToken);
      if (!validation.valid) {
        await githubTokenStorage.clearAuth();
        return false;
      }

      // 恢复认证状态
      const user = await githubTokenStorage.getUserInfo();
      const tokenInfo = await githubTokenStorage.getTokenInfo();
      const lastValidated = await githubTokenStorage.getLastValidated();

      this.currentAuthState = {
        isAuthenticated: true,
        user: user || validation.user,
        tokenInfo: tokenInfo || {
          scopes: validation.scopes || [],
          tokenType: 'personal',
          createdAt: new Date(),
          lastUsed: new Date(),
        },
        lastValidated: lastValidated || new Date(),
      };

      // 如果需要刷新，则进行刷新
      if (await githubTokenStorage.needsRefresh()) {
        await this.refreshAuth();
      }

      this.notifyAuthListeners();
      return true;
    } catch (error) {
      console.error('认证服务初始化失败:', error);
      return false;
    }
  }

  /**
   * 使用Token进行认证
   */
  async authenticateWithToken(token: string): Promise<AuthenticationResult> {
    try {
      // 验证Token格式
      if (!this.isValidTokenFormat(token)) {
        return {
          success: false,
          error: 'Invalid token format',
        };
      }

      // 验证Token有效性
      const validation = await this.validateToken(token);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Token validation failed',
        };
      }

      // 获取用户信息和Token信息
      const { user, scopes, rateLimit } = validation;
      if (!user) {
        return {
          success: false,
          error: 'Unable to retrieve user information',
        };
      }

      // 创建TokenInfo
      const tokenInfo: TokenInfo = {
        scopes: scopes || [],
        tokenType: 'personal',
        createdAt: new Date(),
        lastUsed: new Date(),
        rateLimit,
      };

      // 创建AuthState
      const authState: AuthState = {
        isAuthenticated: true,
        user,
        tokenInfo,
        lastValidated: new Date(),
      };

      // 保存到存储
      await githubTokenStorage.storeToken(token);
      await githubTokenStorage.saveUserInfo(user);
      await githubTokenStorage.storeTokenInfo(tokenInfo);
      await githubTokenStorage.updateLastValidated();
      await githubTokenStorage.storeAuthState(authState);

      // 更新内存中的状态
      this.currentAuthState = authState;
      this.notifyAuthListeners();

      return {
        success: true,
        user,
      };
    } catch (error) {
      console.error('Token认证失败:', error);

      const authError: AuthError = {
        code: 'AUTHENTICATION_FAILED',
        message: error instanceof Error ? error.message : 'Authentication failed',
        timestamp: new Date(),
        recoverable: this.isRecoverableError(error),
      };

      return {
        success: false,
        error: authError.message,
      };
    }
  }

  /**
   * 获取当前认证状态
   */
  async getAuthState(): Promise<AuthState> {
    // 如果内存中没有状态，尝试从存储中加载
    if (!this.currentAuthState.isAuthenticated) {
      await this.initialize();
    }

    return { ...this.currentAuthState };
  }

  /**
   * 刷新认证状态
   */
  async refreshAuth(): Promise<boolean> {
    try {
      const token = await githubTokenStorage.getToken();
      if (!token) {
        return false;
      }

      // 验证Token仍然有效
      const validation = await this.validateToken(token);
      if (!validation.valid) {
        await this.clearAuth();
        return false;
      }

      // 更新用户信息和Token信息
      if (validation.user) {
        await githubTokenStorage.saveUserInfo(validation.user);
        this.currentAuthState.user = validation.user;
      }

      if (validation.scopes) {
        const tokenInfo: TokenInfo = {
          ...this.currentAuthState.tokenInfo!,
          scopes: validation.scopes,
          lastUsed: new Date(),
          rateLimit: validation.rateLimit,
        };
        await githubTokenStorage.storeTokenInfo(tokenInfo);
        this.currentAuthState.tokenInfo = tokenInfo;
      }

      // 更新最后验证时间
      await githubTokenStorage.updateLastValidated();
      this.currentAuthState.lastValidated = new Date();

      // 保存更新后的状态
      await githubTokenStorage.storeAuthState(this.currentAuthState);
      this.notifyAuthListeners();

      return true;
    } catch (error) {
      console.error('刷新认证失败:', error);
      await this.clearAuth();
      return false;
    }
  }

  /**
   * 清除认证信息
   */
  async clearAuth(): Promise<void> {
    try {
      await githubTokenStorage.clearAuth();

      this.currentAuthState = {
        isAuthenticated: false,
      };

      this.notifyAuthListeners();
    } catch (error) {
      console.error('清除认证失败:', error);
      throw error;
    }
  }

  /**
   * 验证Token
   */
  private async validateToken(token: string): Promise<TokenValidationResult & { user?: GitHubUser; scopes?: string[]; rateLimit?: TokenInfo['rateLimit'] }> {
    try {
      const octokit = new Octokit({ auth: token });

      // 获取用户信息
      const userResponse = await octokit.rest.users.getAuthenticated();
      const user: GitHubUser = {
        id: userResponse.data.id,
        login: userResponse.data.login,
        avatar_url: userResponse.data.avatar_url,
        name: userResponse.data.name,
        email: userResponse.data.email,
        public_repos: userResponse.data.public_repos,
        followers: userResponse.data.followers,
        following: userResponse.data.following,
      };

      // 获取Token权限范围
      const scopes = this.extractScopesFromHeaders(userResponse.headers);

      // 获取速率限制信息
      const rateLimitResponse = await octokit.rest.rateLimit.get();
      const rateLimit = {
        limit: rateLimitResponse.data.rate.limit,
        remaining: rateLimitResponse.data.rate.remaining,
        reset: new Date(rateLimitResponse.data.rate.reset * 1000),
        used: rateLimitResponse.data.rate.used,
      };

      return {
        valid: true,
        user,
        scopes,
        rateLimit,
      };
    } catch (error: any) {
      console.error('Token验证失败:', error);

      let errorMessage = 'Token validation failed';

      if (error.status === 401) {
        errorMessage = 'Bad credentials';
      } else if (error.status === 403) {
        if (error.message?.includes('rate limit')) {
          errorMessage = 'GitHub API rate limit exceeded';
        } else {
          errorMessage = 'Resource not accessible by personal access token';
        }
      } else if (error.message?.includes('ENOTFOUND') || error.message?.includes('ECONNREFUSED')) {
        errorMessage = 'Network error: Unable to connect to GitHub API';
      }

      return {
        valid: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 检查Token格式是否有效
   */
  private isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // 去除空白字符
    token = token.trim();

    // 检查长度
    if (token.length < 10) {
      return false;
    }

    // 检查GitHub Token格式
    const validPrefixes = ['github_pat_', 'ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_'];
    const hasValidPrefix = validPrefixes.some(prefix => token.startsWith(prefix));

    if (!hasValidPrefix) {
      return false;
    }

    return true;
  }

  /**
   * 从响应头中提取权限范围
   */
  private extractScopesFromHeaders(headers: any): string[] {
    const scopes = headers['x-oauth-scopes'];
    if (!scopes) {
      return [];
    }

    return scopes.split(', ').map((scope: string) => scope.trim()).filter(Boolean);
  }

  /**
   * 判断错误是否可恢复
   */
  private isRecoverableError(error: any): boolean {
    if (error?.status === 401) {
      return false; // 认证错误通常不可恢复
    }

    if (error?.status === 403 && !error?.message?.includes('rate limit')) {
      return false; // 权限错误（非速率限制）通常不可恢复
    }

    if (error?.message?.includes('ENOTFOUND') || error?.message?.includes('ECONNREFUSED')) {
      return true; // 网络错误可恢复
    }

    return true; // 其他错误默认可恢复
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
        listener({ ...this.currentAuthState });
      } catch (error) {
        console.error('认证状态监听器执行失败:', error);
      }
    });
  }

  /**
   * 检查是否需要重新认证
   */
  async needsAuthentication(): Promise<boolean> {
    const authState = await this.getAuthState();
    return !authState.isAuthenticated;
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<GitHubUser | null> {
    const authState = await this.getAuthState();
    return authState.user || null;
  }

  /**
   * 获取Octokit实例（用于其他服务）
   */
  async getOctokit(): Promise<Octokit | null> {
    const token = await githubTokenStorage.getToken();
    if (!token) {
      return null;
    }

    return new Octokit({ auth: token });
  }
}

// 导出单例实例
export const enhancedGitHubAuthService = new EnhancedGitHubAuthService();