import { create } from 'zustand';
import { githubAPI } from '@/api';
import type { AuthState } from "@shared/types"

interface AuthStore {
  authState: AuthState;
  isLoading: boolean;
  error: string | null;
  login: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  clearError: () => void;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  authState: { isAuthenticated: false },
  isLoading: true,
  error: null,

  login: async (token: string): Promise<boolean> => {
    try {
      set({ isLoading: true, error: null });

      await githubAPI.authenticateWithToken(token);
      const newAuthState = await githubAPI.getAuthState();
      set({ authState: newAuthState, isLoading: false });
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '登录过程中发生错误';
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  logout: async (): Promise<void> => {
    try {
      set({ isLoading: true });
      await githubAPI.clearAuth();
      set({
        authState: { isAuthenticated: false },
        error: null,
        isLoading: false
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '登出失败';
      set({ error: errorMessage, isLoading: false });
    }
  },

  refreshAuth: async (): Promise<boolean> => {
    try {
      set({ isLoading: true });
      const success = await githubAPI.refreshAuth();

      if (success) {
        const newAuthState = await githubAPI.getAuthState();
        set({ authState: newAuthState, isLoading: false });
      } else {
        set({ authState: { isAuthenticated: false }, isLoading: false });
      }

      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '刷新认证失败';
      set({
        error: errorMessage,
        authState: { isAuthenticated: false },
        isLoading: false
      });
      return false;
    }
  },

  clearError: () => {
    set({ error: null });
  },

  initAuth: async () => {
    try {
      const currentState = await githubAPI.getAuthState();

      if (currentState.isAuthenticated) {
        // 验证token是否仍然有效
        const isValid = await githubAPI.refreshAuth();
        if (isValid) {
          const updatedState = await githubAPI.getAuthState();
          set({ authState: updatedState, isLoading: false });
        } else {
          set({ authState: { isAuthenticated: false }, isLoading: false });
        }
      } else {
        set({ authState: { isAuthenticated: false }, isLoading: false });
      }

      // TODO: 实现认证状态变化监听
      // 由于重构到 main 进程，暂时移除监听器
    } catch (err) {
      console.error('初始化认证状态失败:', err);
      set({
        authState: { isAuthenticated: false },
        error: '初始化认证状态失败',
        isLoading: false
      });
    }
  },
}));