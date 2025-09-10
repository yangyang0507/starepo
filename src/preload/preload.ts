import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "@shared/constants/ipc-channels";
import type { APIResponse, ThemeMode, Language } from "@shared/types";

/**
 * 预加载脚本 - 在渲染进程和主进程之间提供安全的通信桥梁
 * 这里暴露的 API 将在渲染进程中通过 window.electronAPI 访问
 */

// 窗口控制 API
const windowAPI = {
  minimize: (): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW.MINIMIZE),

  maximize: (): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW.MAXIMIZE),

  close: (): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW.CLOSE),

  toggleMaximize: (): Promise<APIResponse<{ isMaximized: boolean }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW.TOGGLE_MAXIMIZE),

  setFullscreen: (
    fullscreen: boolean,
  ): Promise<APIResponse<{ isFullscreen: boolean }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW.SET_FULLSCREEN, fullscreen),
};

// 主题控制 API
const themeAPI = {
  getTheme: (): Promise<APIResponse<ThemeMode>> =>
    ipcRenderer.invoke(IPC_CHANNELS.THEME.GET_THEME),

  setTheme: (theme: ThemeMode): Promise<APIResponse<ThemeMode>> =>
    ipcRenderer.invoke(IPC_CHANNELS.THEME.SET_THEME, theme),

  toggleTheme: (): Promise<APIResponse<ThemeMode>> =>
    ipcRenderer.invoke(IPC_CHANNELS.THEME.TOGGLE_THEME),

  // 监听主题变化
  onThemeChanged: (callback: (theme: ThemeMode) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, theme: ThemeMode) =>
      callback(theme);
    ipcRenderer.on(IPC_CHANNELS.THEME.THEME_CHANGED, handler);

    // 返回清理函数
    return () =>
      ipcRenderer.removeListener(IPC_CHANNELS.THEME.THEME_CHANGED, handler);
  },
};

// 语言控制 API
const languageAPI = {
  getLanguage: (): Promise<APIResponse<Language>> =>
    ipcRenderer.invoke(IPC_CHANNELS.LANGUAGE.GET_LANGUAGE),

  setLanguage: (language: Language): Promise<APIResponse<Language>> =>
    ipcRenderer.invoke(IPC_CHANNELS.LANGUAGE.SET_LANGUAGE, language),

  // 监听语言变化
  onLanguageChanged: (callback: (language: Language) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, language: Language) =>
      callback(language);
    ipcRenderer.on(IPC_CHANNELS.LANGUAGE.LANGUAGE_CHANGED, handler);

    // 返回清理函数
    return () =>
      ipcRenderer.removeListener(
        IPC_CHANNELS.LANGUAGE.LANGUAGE_CHANGED,
        handler,
      );
  },
};

// 未来的 API 接口 (暂时为空实现)
const githubAPI = {
  // TODO: 实现 GitHub 相关 API
  authenticate: () =>
    Promise.resolve({ success: false, error: "Not implemented" }),
  getStars: () => Promise.resolve({ success: false, error: "Not implemented" }),
};

// 安全存储通道常量
const SECURE_STORAGE_CHANNELS = {
  // GitHub Token 相关
  SAVE_GITHUB_TOKEN: "secure-storage:save-github-token",
  GET_GITHUB_TOKEN: "secure-storage:get-github-token",
  SAVE_USER_INFO: "secure-storage:save-user-info",
  GET_USER_INFO: "secure-storage:get-user-info",
  GET_AUTH_METHOD: "secure-storage:get-auth-method",
  HAS_VALID_AUTH: "secure-storage:has-valid-auth",
  CLEAR_AUTH: "secure-storage:clear-auth",

  // 通用安全存储
  SET_ITEM: "secure-storage:set-item",
  GET_ITEM: "secure-storage:get-item",
  REMOVE_ITEM: "secure-storage:remove-item",
  HAS_ITEM: "secure-storage:has-item",
  GET_ALL_KEYS: "secure-storage:get-all-keys",
  CLEAR_ALL: "secure-storage:clear-all",
  GET_STATS: "secure-storage:get-stats",

  // 系统检查
  IS_ENCRYPTION_AVAILABLE: "secure-storage:is-encryption-available",
} as const;

// 安全存储 API
const secureStorageAPI = {
  // GitHub Token 相关
  saveGitHubToken: (token: string, authMethod: "token") =>
    ipcRenderer.invoke(
      SECURE_STORAGE_CHANNELS.SAVE_GITHUB_TOKEN,
      token,
      authMethod,
    ),

  getGitHubToken: () =>
    ipcRenderer.invoke(SECURE_STORAGE_CHANNELS.GET_GITHUB_TOKEN),

  saveUserInfo: (userInfo: import("@shared/types").GitHubUser) =>
    ipcRenderer.invoke(SECURE_STORAGE_CHANNELS.SAVE_USER_INFO, userInfo),

  getUserInfo: () => ipcRenderer.invoke(SECURE_STORAGE_CHANNELS.GET_USER_INFO),

  getAuthMethod: () =>
    ipcRenderer.invoke(SECURE_STORAGE_CHANNELS.GET_AUTH_METHOD),

  hasValidAuth: () =>
    ipcRenderer.invoke(SECURE_STORAGE_CHANNELS.HAS_VALID_AUTH),

  clearAuth: () => ipcRenderer.invoke(SECURE_STORAGE_CHANNELS.CLEAR_AUTH),

  // 通用安全存储
  setItem: (key: string, value: string, expiresIn?: number) =>
    ipcRenderer.invoke(SECURE_STORAGE_CHANNELS.SET_ITEM, key, value, expiresIn),

  getItem: (key: string) =>
    ipcRenderer.invoke(SECURE_STORAGE_CHANNELS.GET_ITEM, key),

  removeItem: (key: string) =>
    ipcRenderer.invoke(SECURE_STORAGE_CHANNELS.REMOVE_ITEM, key),

  hasItem: (key: string) =>
    ipcRenderer.invoke(SECURE_STORAGE_CHANNELS.HAS_ITEM, key),

  getAllKeys: () => ipcRenderer.invoke(SECURE_STORAGE_CHANNELS.GET_ALL_KEYS),

  clearAll: () => ipcRenderer.invoke(SECURE_STORAGE_CHANNELS.CLEAR_ALL),

  getStats: () => ipcRenderer.invoke(SECURE_STORAGE_CHANNELS.GET_STATS),

  // 系统检查
  isEncryptionAvailable: () =>
    ipcRenderer.invoke(SECURE_STORAGE_CHANNELS.IS_ENCRYPTION_AVAILABLE),
};

const databaseAPI = {
  // TODO: 实现数据库相关 API
  search: () => Promise.resolve({ success: false, error: "Not implemented" }),
  storeRepo: () =>
    Promise.resolve({ success: false, error: "Not implemented" }),
};

const aiAPI = {
  // TODO: 实现 AI 相关 API
  chat: () => Promise.resolve({ success: false, error: "Not implemented" }),
  searchSemantic: () =>
    Promise.resolve({ success: false, error: "Not implemented" }),
};

// Shell API - 用于打开外部链接
const shellAPI = {
  openExternal: (url: string): Promise<APIResponse> =>
    ipcRenderer.invoke("shell:openExternal", url),
  openPath: (path: string): Promise<APIResponse<string>> =>
    ipcRenderer.invoke("shell:openPath", path),
  showItemInFolder: (fullPath: string): Promise<APIResponse> =>
    ipcRenderer.invoke("shell:showItemInFolder", fullPath),
};

// 合并所有 API
const electronAPI = {
  window: windowAPI,
  theme: themeAPI,
  language: languageAPI,
  github: githubAPI,
  database: databaseAPI,
  ai: aiAPI,
  secureStorage: secureStorageAPI,
  shell: shellAPI,
};

// 将 API 暴露给渲染进程
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// 导出类型定义供 TypeScript 使用
export type ElectronAPI = typeof electronAPI;
