import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { githubAuthService } from "@/services/github/auth-service";
import type { AuthState } from "@/services/github/types";

interface AuthContextType {
  authState: AuthState;
  isLoading: boolean;
  error: string | null;
  login: (token: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (token: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await githubAuthService.authenticateWithToken(token);

      if (result.success) {
        const newAuthState = githubAuthService.getAuthState();
        setAuthState(newAuthState);
        return true;
      } else {
        setError(result.error || "登录失败");
        return false;
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "登录过程中发生错误";
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      await githubAuthService.clearAuth();
      setAuthState({ isAuthenticated: false });
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "登出失败";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshAuth = useCallback(async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      const success = await githubAuthService.refreshAuth();

      if (success) {
        const newAuthState = githubAuthService.getAuthState();
        setAuthState(newAuthState);
      } else {
        setAuthState({ isAuthenticated: false });
      }

      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "刷新认证失败";
      setError(errorMessage);
      setAuthState({ isAuthenticated: false });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    // 初始化认证状态
    const initAuth = async () => {
      try {
        const currentState = githubAuthService.getAuthState();

        if (currentState.isAuthenticated) {
          // 验证token是否仍然有效
          const isValid = await githubAuthService.refreshAuth();
          if (isValid) {
            const updatedState = githubAuthService.getAuthState();
            setAuthState(updatedState);
          } else {
            setAuthState({ isAuthenticated: false });
          }
        } else {
          setAuthState({ isAuthenticated: false });
        }
      } catch (err) {
        console.error("初始化认证状态失败:", err);
        setAuthState({ isAuthenticated: false });
        setError("初始化认证状态失败");
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // 监听认证状态变化
    const unsubscribe = githubAuthService.addAuthListener((newAuthState) => {
      setAuthState(newAuthState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const contextValue: AuthContextType = {
    authState,
    isLoading,
    error,
    login,
    logout,
    refreshAuth,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
