import { useState, useEffect } from "react";
import { themeAPI } from "@/services/api";
import type { ThemeMode } from "@shared/types";

/**
 * 主题管理 Hook
 * 提供主题状态管理和切换功能
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 更新DOM主题类
  const updateDOMTheme = (themeMode: ThemeMode) => {
    // 移除现有的主题类
    document.documentElement.classList.remove("dark", "light");

    if (themeMode === "dark") {
      document.documentElement.classList.add("dark");
    } else if (themeMode === "light") {
      document.documentElement.classList.add("light");
    } else {
      // system theme - 检测系统主题
      const systemIsDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      if (systemIsDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.add("light");
      }
    }
  };

  // 初始化主题
  useEffect(() => {
    const loadTheme = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 检查localStorage中的主题设置
        const localTheme = localStorage.getItem("theme") as ThemeMode | null;

        if (localTheme) {
          // 如果有本地设置，使用本地设置
          await themeAPI.setTheme(localTheme);
          setTheme(localTheme);
          updateDOMTheme(localTheme);
        } else {
          // 否则获取当前主题（默认为system）
          const currentTheme = await themeAPI.getTheme();
          setTheme(currentTheme);
          updateDOMTheme(currentTheme);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load theme");
        console.error("Failed to load theme:", err);
        // 发生错误时设置默认主题
        setTheme("system");
        updateDOMTheme("system");
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  // 监听主题变化
  useEffect(() => {
    const cleanup = themeAPI.onThemeChanged((newTheme) => {
      setTheme(newTheme);
      updateDOMTheme(newTheme);
    });

    return cleanup;
  }, []);

  // 切换主题
  const toggleTheme = async () => {
    try {
      setError(null);
      const newTheme = await themeAPI.toggleTheme();
      setTheme(newTheme);
      updateDOMTheme(newTheme);
      localStorage.setItem("theme", newTheme);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle theme");
      console.error("Failed to toggle theme:", err);
    }
  };

  // 设置特定主题
  const changeTheme = async (newTheme: ThemeMode) => {
    try {
      setError(null);
      const updatedTheme = await themeAPI.setTheme(newTheme);
      setTheme(updatedTheme);
      updateDOMTheme(updatedTheme);
      localStorage.setItem("theme", updatedTheme);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change theme");
      console.error("Failed to change theme:", err);
    }
  };

  return {
    theme,
    isLoading,
    error,
    toggleTheme,
    changeTheme,
  };
}
