/**
 * 增强的认证API
 * 使用新的AUTH_IPC_CHANNELS和类型定义
 */

import { AUTH_IPC_CHANNELS } from '@shared/types/auth';
import type {
  AuthState,
  GitHubUser,
  TokenValidationResult,
  AuthenticateWithTokenRequest,
  AuthenticateWithTokenResponse,
  GetAuthStateRequest,
  GetAuthStateResponse,
  RefreshAuthRequest,
  RefreshAuthResponse,
  ClearAuthRequest,
  ClearAuthResponse,
} from '@shared/types/auth';

/**
 * 检查 electronAPI 是否可用
 */
function ensureElectronAPI(): void {
  if (!window.electronAPI) {
    throw new Error(
      'ElectronAPI is not available. Make sure preload script is loaded.',
    );
  }
}

/**
 * 增强的GitHub认证API
 */
export const enhancedAuthAPI = {
  /**
   * 使用Token进行认证
   */
  async authenticateWithToken(token: string): Promise<{ success: boolean; user?: GitHubUser; error?: string }> {
    ensureElectronAPI();

    const request: AuthenticateWithTokenRequest = { token };
    const response: AuthenticateWithTokenResponse = await window.electronAPI.invoke(
      AUTH_IPC_CHANNELS.AUTHENTICATE_WITH_TOKEN,
      request
    );

    if (response.success) {
      return {
        success: true,
        user: response.user,
      };
    } else {
      return {
        success: false,
        error: response.error,
      };
    }
  },

  /**
   * 获取当前认证状态
   */
  async getAuthState(): Promise<AuthState> {
    ensureElectronAPI();

    const request: GetAuthStateRequest = {};
    const response: GetAuthStateResponse = await window.electronAPI.invoke(
      AUTH_IPC_CHANNELS.GET_AUTH_STATE,
      request
    );

    return response.authState;
  },

  /**
   * 刷新认证状态
   */
  async refreshAuth(): Promise<boolean> {
    ensureElectronAPI();

    const request: RefreshAuthRequest = {};
    const response: RefreshAuthResponse = await window.electronAPI.invoke(
      AUTH_IPC_CHANNELS.REFRESH_AUTH,
      request
    );

    return response.success;
  },

  /**
   * 清除认证信息
   */
  async clearAuth(): Promise<void> {
    ensureElectronAPI();

    const request: ClearAuthRequest = {};
    const response: ClearAuthResponse = await window.electronAPI.invoke(
      AUTH_IPC_CHANNELS.CLEAR_AUTH,
      request
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to clear authentication');
    }
  },

  /**
   * 初始化认证状态（应用启动时调用）
   */
  async initializeAuth(): Promise<boolean> {
    try {
      const authState = await this.getAuthState();

      if (authState.isAuthenticated) {
        // 如果已认证，尝试刷新状态以验证Token仍然有效
        return await this.refreshAuth();
      }

      return false;
    } catch (error) {
      console.error('Initialize auth failed:', error);
      return false;
    }
  },

  /**
   * 检查是否需要重新认证
   */
  async needsAuthentication(): Promise<boolean> {
    try {
      const authState = await this.getAuthState();
      return !authState.isAuthenticated;
    } catch (error) {
      console.error('Check authentication need failed:', error);
      return true;
    }
  },

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<GitHubUser | null> {
    try {
      const authState = await this.getAuthState();
      return authState.user || null;
    } catch (error) {
      console.error('Get current user failed:', error);
      return null;
    }
  },

  /**
   * 验证Token是否有效
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // 通过认证来验证token
      const result = await this.authenticateWithToken(token);

      if (result.success && result.user) {
        return {
          valid: true,
          user: result.user,
          scopes: [], // 可以从GitHub API获取实际的scopes
        };
      } else {
        return {
          valid: false,
          error: result.error || 'Invalid token',
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Token validation failed',
      };
    }
  },
};