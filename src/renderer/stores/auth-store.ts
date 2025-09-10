import { create } from 'zustand';
import { githubAuthService } from '@/services/github/auth-service';
import type { AuthState } from '@/services/github/types';

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

      const result = await githubAuthService.authenticateWithToken(token);

      if (result.success) {
        const newAuthState = githubAuthService.getAuthState();
        set({ authState: newAuthState, isLoading: false });
        return true;
      } else {
        set({ error: result.error || '登录失败', isLoading: false });
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '登录过程中发生错误';
      set({ error: errorMessage, isLoading: false });
      return false;
    }
  },

  logout: async (): Promise<void> => {
    try {
      set({ isLoading: true });
      await githubAuthService.clearAuth();
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
      const success = await githubAuthService.refreshAuth();

      if (success) {
        const newAuthState = githubAuthService.getAuthState();
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
      const currentState = githubAuthService.getAuthState();

      if (currentState.isAuthenticated) {
        // 验证token是否仍然有效
        const isValid = await githubAuthService.refreshAuth();
        if (isValid) {
          const updatedState = githubAuthService.getAuthState();
          set({ authState: updatedState, isLoading: false });
        } else {
          set({ authState: { isAuthenticated: false }, isLoading: false });
        }
      } else {
        set({ authState: { isAuthenticated: false }, isLoading: false });
      }

      // 监听认证状态变化
      githubAuthService.addAuthListener((newAuthState) => {
        set({ authState: newAuthState });
      });
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