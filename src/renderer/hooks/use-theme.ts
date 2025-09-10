import { useEffect } from "react";
import { useThemeStore } from "@/stores/theme-store";

/**
 * 主题管理 Hook (Zustand compatibility wrapper)
 * 提供主题状态管理和切换功能
 */
export function useTheme() {
  const { theme, isLoading, error, toggleTheme, changeTheme, initTheme } = useThemeStore();

  // Initialize theme on first use only
  useEffect(() => {
    if (isLoading && theme === 'system') {
      initTheme();
    }
  }, []); // Empty dependency array to run only once

  return {
    theme,
    isLoading,
    error,
    toggleTheme,
    changeTheme,
  };
}
