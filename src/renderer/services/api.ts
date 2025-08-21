/**
 * 渲染进程 API 服务层
 * 封装对 electronAPI 的调用，提供类型安全的接口
 */

import type { ThemeMode, Language } from "@shared/types";

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
 * 窗口控制 API
 */
export const windowAPI = {
  minimize: async (): Promise<void> => {
    ensureElectronAPI();
    const result = await window.electronAPI.window.minimize();
    if (!result.success) {
      throw new Error(result.error || "Failed to minimize window");
    }
  },

  maximize: async (): Promise<void> => {
    ensureElectronAPI();
    const result = await window.electronAPI.window.maximize();
    if (!result.success) {
      throw new Error(result.error || "Failed to maximize window");
    }
  },

  close: async (): Promise<void> => {
    ensureElectronAPI();
    const result = await window.electronAPI.window.close();
    if (!result.success) {
      throw new Error(result.error || "Failed to close window");
    }
  },

  toggleMaximize: async (): Promise<boolean> => {
    ensureElectronAPI();
    const result = await window.electronAPI.window.toggleMaximize();
    if (!result.success) {
      throw new Error(result.error || "Failed to toggle maximize");
    }
    return result.data?.isMaximized || false;
  },

  setFullscreen: async (fullscreen: boolean): Promise<boolean> => {
    ensureElectronAPI();
    const result = await window.electronAPI.window.setFullscreen(fullscreen);
    if (!result.success) {
      throw new Error(result.error || "Failed to set fullscreen");
    }
    return result.data?.isFullscreen || false;
  },
};

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

/**
 * 语言控制 API
 */
export const languageAPI = {
  getLanguage: async (): Promise<Language> => {
    ensureElectronAPI();
    const result = await window.electronAPI.language.getLanguage();
    if (!result.success) {
      throw new Error(result.error || "Failed to get language");
    }
    return result.data as Language;
  },

  setLanguage: async (language: Language): Promise<Language> => {
    ensureElectronAPI();
    const result = await window.electronAPI.language.setLanguage(language);
    if (!result.success) {
      throw new Error(result.error || "Failed to set language");
    }
    return result.data as Language;
  },

  onLanguageChanged: (callback: (language: Language) => void): (() => void) => {
    ensureElectronAPI();
    return window.electronAPI.language.onLanguageChanged(callback);
  },
};

/**
 * 未来的 API 接口
 */
export const githubAPI = {
  // TODO: 实现 GitHub API
};

export const databaseAPI = {
  // TODO: 实现数据库 API
};

export const aiAPI = {
  // TODO: 实现 AI API
};
