import { create } from 'zustand';
import { enhancedAuthAPI } from '@/api';
import type { AuthState, AuthError, GitHubUser } from '@shared/types/auth';

interface AuthStore {
  authState: AuthState;
  isLoading: boolean;
  error: AuthError | null;
  login: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  clearError: () => void;
  initAuth: () => Promise<void>;
  // 新增的便捷方法
  isAuthenticated: () => boolean;
  getCurrentUser: () => GitHubUser | undefined;
  // 内部方法（用于测试）
  _setError?: (error: AuthError) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  authState: { isAuthenticated: false },
  isLoading: true,
  error: null,

  login: async (token: string): Promise<boolean> => {
    try {
      set({ isLoading: true, error: null });

      const result = await enhancedAuthAPI.authenticateWithToken(token);
      if (result.success) {
        const newAuthState = await enhancedAuthAPI.getAuthState();
        set({ authState: newAuthState, isLoading: false });
        return true;
      } else {
        const authError: AuthError = {
          code: 'AUTHENTICATION_FAILED',
          message: result.error || '认证失败',
          timestamp: new Date(),
          recoverable: true,
        };
        set({ error: authError, isLoading: false });
        return false;
      }
    } catch (err) {
      const authError: AuthError = {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : '登录过程中发生未知错误',
        timestamp: new Date(),
        recoverable: true,
      };
      set({ error: authError, isLoading: false });
      return false;
    }
  },

  logout: async (): Promise<void> => {
    try {
      set({ isLoading: true });
      await enhancedAuthAPI.clearAuth();
      set({
        authState: { isAuthenticated: false },
        error: null,
        isLoading: false
      });
    } catch (err) {
      const authError: AuthError = {
        code: 'LOGOUT_FAILED',
        message: err instanceof Error ? err.message : '登出失败',
        timestamp: new Date(),
        recoverable: true,
      };
      set({ error: authError, isLoading: false });
    }
  },

  refreshAuth: async (): Promise<boolean> => {
    try {
      set({ isLoading: true, error: null });
      const success = await enhancedAuthAPI.refreshAuth();

      if (success) {
        const newAuthState = await enhancedAuthAPI.getAuthState();
        set({ authState: newAuthState, isLoading: false });
      } else {
        set({ authState: { isAuthenticated: false }, isLoading: false });
      }

      return success;
    } catch (err) {
      const authError: AuthError = {
        code: 'REFRESH_FAILED',
        message: err instanceof Error ? err.message : '刷新认证失败',
        timestamp: new Date(),
        recoverable: true,
      };
      set({
        error: authError,
        authState: { isAuthenticated: false },
        isLoading: false
      });
      return false;
    }
  },

  clearError: () => {
    set({ error: null });
  },

  // 便捷方法
  isAuthenticated: () => {
    return get().authState.isAuthenticated;
  },

  getCurrentUser: () => {
    return get().authState.user;
  },

  // 内部方法（主要用于测试）
  _setError: (error: AuthError) => {
    set({ error });
  },

  initAuth: async () => {
    try {
      set({ isLoading: true, error: null });

      await enhancedAuthAPI.initializeAuth();
      const authState = await enhancedAuthAPI.getAuthState();

      set({
        authState,
        isLoading: false,
        error: null
      });
    } catch (err) {
      console.error('初始化认证状态失败:', err);
      const authError: AuthError = {
        code: 'INITIALIZATION_FAILED',
        message: err instanceof Error ? err.message : '初始化认证状态失败',
        timestamp: new Date(),
        recoverable: true,
      };
      set({
        authState: { isAuthenticated: false },
        error: authError,
        isLoading: false
      });
    }
  },
}));