/**
 * 主题控制 API
 * 封装主题相关的electronAPI调用
 */

import type { ThemeMode } from "@shared/types";

/**
 * 检查 electronAPI 是否可用
 */
function ensureElectronAPI(): void {
  if (!window.electronAPI) {
    throw new Error(
      "ElectronAPI is not available. Make sure preload script is loaded.",
    );
  }
}

/**
 * 主题控制 API
 */
export const themeAPI = {
  getTheme: async (): Promise<ThemeMode> => {
    ensureElectronAPI();
    const result = await window.electronAPI.theme.getTheme();
    if (!result.success) {
      throw new Error(result.error || "Failed to get theme");
    }
    return result.data as ThemeMode;
  },

  setTheme: async (theme: ThemeMode): Promise<ThemeMode> => {
    ensureElectronAPI();
    const result = await window.electronAPI.theme.setTheme(theme);
    if (!result.success) {
      throw new Error(result.error || "Failed to set theme");
    }
    return result.data as ThemeMode;
  },

  toggleTheme: async (): Promise<ThemeMode> => {
    ensureElectronAPI();
    const result = await window.electronAPI.theme.toggleTheme();
    if (!result.success) {
      throw new Error(result.error || "Failed to toggle theme");
    }
    return result.data as ThemeMode;
  },

  onThemeChanged: (callback: (theme: ThemeMode) => void): (() => void) => {
    ensureElectronAPI();
    return window.electronAPI.theme.onThemeChanged(callback);
  },
};