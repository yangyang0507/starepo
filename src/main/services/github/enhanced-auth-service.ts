import { Octokit } from 'octokit';
import { githubTokenStorage } from '../database/secure-service';
import { octokitManager } from './octokit-manager';
import { getLogger } from '../../utils/logger';
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
  private initialized = false;
  private initializationPromise: Promise<boolean> | null = null;
  private lastValidationTimestamp: number | null = null;
  private readonly validationCacheDuration = 60 * 1000; // 60s 缓存认证结果
  private readonly log = getLogger('github:auth-service');

  /**
   * 初始化认证服务，从存储中恢复认证状态
   */
  async initialize(): Promise<boolean> {
    if (this.initialized && !this.initializationPromise) {
      return this.currentAuthState.isAuthenticated;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();

    try {
      return await this.initializationPromise;
    } finally {
      this.initialized = true;
      this.initializationPromise = null;
    }
  }

  private async performInitialization(): Promise<boolean> {
    try {
      const storedToken = await githubTokenStorage.getToken();
      if (!storedToken) {
        this.currentAuthState = { isAuthenticated: false };
        return false;
      }

      if (await githubTokenStorage.isExpired()) {
        await githubTokenStorage.clearAuth();
        this.currentAuthState = { isAuthenticated: false };
        return false;
      }

      const validation = await this.validateToken(storedToken);
      if (!validation.valid) {
        await githubTokenStorage.clearAuth();
        this.currentAuthState = { isAuthenticated: false };
        return false;
      }

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
          rateLimit: validation.rateLimit,
        },
        lastValidated: lastValidated || new Date(),
      };

      await githubTokenStorage.storeAuthState(this.currentAuthState);

      if (await githubTokenStorage.needsRefresh()) {
        await this.refreshAuth(true);
      } else {
        this.updateLastValidationTimestamp();
      }

      this.notifyAuthListeners();

      if (this.currentAuthState.isAuthenticated) {
        try {
          await octokitManager.initialize({
            authMethod: 'token',
            token: storedToken,
            userAgent: 'Starepo/1.0.0',
            timeout: 10000,
          });
          this.log.info('octokitManager 已从存储恢复认证状态');
        } catch (octokitError) {
          this.log.warn('octokitManager 恢复失败，但不影响主认证流程', octokitError);
        }
      }

      return true;
    } catch (error) {
      this.log.error('认证服务初始化失败', error);
      this.currentAuthState = { isAuthenticated: false };
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
      this.initialized = true;
      this.updateLastValidationTimestamp();
      this.notifyAuthListeners();

      // 初始化旧系统的 octokitManager，确保认证状态同步
      try {
        await octokitManager.initialize({
          authMethod: 'token',
          token: token,
          userAgent: 'Starepo/1.0.0',
          timeout: 10000,
        });
        this.log.info('octokitManager 已同步认证状态');
      } catch (octokitError) {
        this.log.warn('octokitManager 初始化失败，但不影响主认证流程', octokitError);
      }

      return {
        success: true,
        user: user as any, // 类型断言，避免不同 GitHubUser 定义的冲突
      };
    } catch (error) {
      this.log.error('Token认证失败', error);

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
    await this.ensureInitialized();
    
    this.log.debug('[增强认证服务] 当前认证状态', {
      isAuthenticated: this.currentAuthState.isAuthenticated,
      user: this.currentAuthState.user?.login,
      hasTokenInfo: !!this.currentAuthState.tokenInfo,
    });

    return { ...this.currentAuthState };
  }

  /**
   * 刷新认证状态
   */
  async refreshAuth(force = false): Promise<boolean> {
    try {
      if (!this.initialized && !force) {
        await this.initialize();
      }

      const token = await githubTokenStorage.getToken();
      if (!token) {
        return false;
      }

      if (!force && this.shouldSkipValidation()) {
        this.updateLastValidationTimestamp();
        return true;
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

      if (validation.scopes || validation.rateLimit) {
        const baseTokenInfo: TokenInfo = this.currentAuthState.tokenInfo ?? {
          scopes: validation.scopes || [],
          tokenType: 'personal',
          createdAt: new Date(),
          lastUsed: new Date(),
        };

        const tokenInfo: TokenInfo = {
          ...baseTokenInfo,
          scopes: validation.scopes ?? baseTokenInfo.scopes,
          lastUsed: new Date(),
          rateLimit: validation.rateLimit ?? baseTokenInfo.rateLimit,
        };
        await githubTokenStorage.storeTokenInfo(tokenInfo);
        this.currentAuthState.tokenInfo = tokenInfo;
      }

      // 更新最后验证时间
      await githubTokenStorage.updateLastValidated();
      this.currentAuthState.lastValidated = new Date();

      // 保存更新后的状态
      await githubTokenStorage.storeAuthState(this.currentAuthState);
      this.updateLastValidationTimestamp();
      this.notifyAuthListeners();

      return true;
    } catch (error) {
      this.log.error('刷新认证失败', error);
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
      this.lastValidationTimestamp = null;

      this.notifyAuthListeners();
    } catch (error) {
      this.log.error('清除认证失败', error);
      throw error;
    }
  }

  /**
   * 验证Token
   */
  async validateToken(token: string): Promise<TokenValidationResult & { user?: GitHubUser; scopes?: string[]; rateLimit?: TokenInfo['rateLimit'] }> {
    try {
      const octokit = new Octokit({ auth: token });

      // 获取用户信息
      const userResponse = await octokit.rest.users.getAuthenticated();
      const user: GitHubUser = {
        id: userResponse.data.id,
        login: userResponse.data.login,
        html_url: userResponse.data.html_url,
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
      this.log.error('Token验证失败', error);

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

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private updateLastValidationTimestamp(): void {
    this.lastValidationTimestamp = Date.now();
  }

  private shouldSkipValidation(): boolean {
    if (this.lastValidationTimestamp === null) {
      return false;
    }

    return Date.now() - this.lastValidationTimestamp < this.validationCacheDuration;
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
        this.log.error('认证状态监听器执行失败', error);
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
   * 获取当前用户信息 (同步版本，兼容旧API)
   */
  getCurrentUserSync(): GitHubUser | undefined {
    return this.currentAuthState.user;
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
