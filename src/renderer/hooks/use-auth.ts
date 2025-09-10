import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Compatibility hook that provides the same API as the original AuthContext
 * This allows for gradual migration without breaking existing components
 */
export function useAuth() {
  const store = useAuthStore();

  // Initialize auth on first use
  useEffect(() => {
    if (store.isLoading && !store.authState.isAuthenticated && !store.error) {
      store.initAuth();
    }
  }, [store]);

  return {
    authState: store.authState,
    isLoading: store.isLoading,
    error: store.error,
    login: store.login,
    logout: store.logout,
    refreshAuth: store.refreshAuth,
    clearError: store.clearError,
  };
}