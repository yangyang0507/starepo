import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "@shared/constants/ipc-channels";
import type {
  APIResponse,
  ThemeMode,
  Language,
  AppSettings,
  GitHubRepository,
  GitHubPaginationOptions,
  GitHubSearchOptions,
  RepositorySyncFilters,
  StreamChunk,
} from "@shared/types";

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

// 应用设置 API
const settingsAPI = {
  getSettings: (): Promise<APIResponse<AppSettings>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.GET_SETTINGS),

  updateSettings: (update: Partial<AppSettings>): Promise<APIResponse<AppSettings>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.SET_SETTING, update),

  resetSettings: (): Promise<APIResponse<AppSettings>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.RESET_SETTINGS),

  clearCache: (): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.CLEAR_CACHE),
};

// 搜索 API
const searchAPI = {
  searchRepositories: (options: {
    query?: string;
    language?: string;
    minStars?: number;
    maxStars?: number;
    limit?: number;
    offset?: number;
    page?: number;
    pageSize?: number;
    sortBy?: 'relevance' | 'stars' | 'updated' | 'created';
    sortOrder?: 'asc' | 'desc';
    disableCache?: boolean;
  }): Promise<APIResponse<{
    repositories: GitHubRepository[];
    totalCount: number;
    searchTime: number;
    page: number;
    pageSize: number;
    offset: number;
    hasMore: boolean;
    nextOffset?: number;
    cached?: boolean;
  }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH.SEARCH_REPOSITORIES, options),

  getSearchSuggestions: (input: string, limit?: number): Promise<APIResponse<{
    terms: string[];
    languages: string[];
    topics: string[];
  }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH.GET_SEARCH_SUGGESTIONS, input, limit),

  getPopularSearchTerms: (limit?: number): Promise<APIResponse<{
    languages: Array<{ name: string; count: number }>;
    topics: Array<{ name: string; count: number }>;
  }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH.GET_POPULAR_SEARCH_TERMS, limit),

  getSearchStats: (): Promise<APIResponse<{
    totalRepositories: number;
    totalUsers: number;
    indexSize: number;
  }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH.GET_SEARCH_STATS),
};

// GitHub API
const githubAPI = {
  // 认证相关
  authenticateWithToken: (token: string): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.AUTHENTICATE_WITH_TOKEN, token),

  validateToken: (token: string): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.VALIDATE_TOKEN, token),

  getAuthState: (): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.GET_AUTH_STATE),

  refreshAuth: (): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.REFRESH_AUTH),

  clearAuth: (): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.CLEAR_AUTH),

  // 用户相关
  getCurrentUser: (): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.GET_CURRENT_USER),

  // Star 相关
  getStarredRepositories: (options: GitHubPaginationOptions): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.GET_STARRED_REPOSITORIES, options),

  getUserStarredRepositories: (username: string, options: GitHubPaginationOptions): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.GET_USER_STARRED_REPOSITORIES, username, options),

  checkIfStarred: (owner: string, repo: string): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.CHECK_IF_STARRED, owner, repo),

  starRepository: (owner: string, repo: string): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.STAR_REPOSITORY, owner, repo),

  unstarRepository: (owner: string, repo: string): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.UNSTAR_REPOSITORY, owner, repo),

  getAllStarredRepositories: (options: GitHubPaginationOptions): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.GET_ALL_STARRED_REPOSITORIES, options),

  getStarredStats: (): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.GET_STARRED_STATS),

  searchStarredRepositories: (query: string, options: GitHubSearchOptions): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.SEARCH_STARRED_REPOSITORIES, query, options),

  // 批量操作
  checkMultipleStarStatus: (repositories: Array<{ owner: string; repo: string }>): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.CHECK_MULTIPLE_STAR_STATUS, repositories),

  starMultipleRepositories: (repositories: Array<{ owner: string; repo: string }>): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.STAR_MULTIPLE_REPOSITORIES, repositories),

  unstarMultipleRepositories: (repositories: Array<{ owner: string; repo: string }>): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.UNSTAR_MULTIPLE_REPOSITORIES, repositories),

  // 向量数据库集成
  initializeDatabase: (): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.INITIALIZE_DATABASE),

  getAllStarredRepositoriesEnhanced: (options: GitHubPaginationOptions): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.GET_ALL_STARRED_REPOSITORIES_ENHANCED, options),

  searchRepositoriesSemanticially: (query: string, limit?: number, filters?: RepositorySyncFilters): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.SEARCH_REPOSITORIES_SEMANTICALLY, query, limit, filters),

  getRepositoriesByLanguageFromDatabase: (language: string, limit?: number): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.GET_REPOSITORIES_BY_LANGUAGE_FROM_DB, language, limit),

  getRepositoriesByStarRangeFromDatabase: (minStars: number, maxStars: number, limit?: number): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.GET_REPOSITORIES_BY_STAR_RANGE_FROM_DB, minStars, maxStars, limit),

  getDatabaseStats: (): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.GET_DATABASE_STATS),

  syncRepositoriesToDatabase: (repositories: GitHubRepository[]): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.GITHUB.SYNC_REPOSITORIES_TO_DATABASE, repositories),
};

// 安全存储 API
const secureStorageAPI = {
  // GitHub Token 相关
  saveGitHubToken: (token: string, authMethod: "token") =>
    ipcRenderer.invoke(
      IPC_CHANNELS.SECURE_STORAGE.SAVE_GITHUB_TOKEN,
      token,
      authMethod,
    ),

  getGitHubToken: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE.GET_GITHUB_TOKEN),

  saveUserInfo: (userInfo: import("@shared/types").GitHubUser) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE.SAVE_USER_INFO, userInfo),

  getUserInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE.GET_USER_INFO),

  getAuthMethod: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE.GET_AUTH_METHOD),

  hasValidAuth: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE.HAS_VALID_AUTH),

  clearAuth: () => ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE.CLEAR_AUTH),

  // 通用安全存储
  setItem: (key: string, value: string, expiresIn?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE.SET_ITEM, key, value, expiresIn),

  getItem: (key: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE.GET_ITEM, key),

  removeItem: (key: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE.REMOVE_ITEM, key),

  hasItem: (key: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE.HAS_ITEM, key),

  getAllKeys: () => ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE.GET_ALL_KEYS),

  clearAll: () => ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE.CLEAR_ALL),

  getStats: () => ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE.GET_STATS),

  // 系统检查
  isEncryptionAvailable: () =>
    ipcRenderer.invoke(IPC_CHANNELS.SECURE_STORAGE.IS_ENCRYPTION_AVAILABLE),
};

const databaseAPI = {
  // 数据库相关 API
  search: (query: string, options?: { limit?: number; offset?: number }): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.DATABASE.SEARCH, query, options),

  storeRepo: (repo: import("@shared/types").GitHubRepository): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.DATABASE.STORE_REPO, repo),

  getRepos: (options?: { limit?: number; offset?: number; language?: string }): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.DATABASE.GET_REPOS, options),

  deleteRepo: (repoId: number): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.DATABASE.DELETE_REPO, repoId),
};

const aiAPI = {
  // AI 相关 API
  chat: (message: string, conversationId?: string): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI.CHAT, { message, conversationId }),

  // 流式聊天 API
  chatStream: (
    message: string,
    conversationId?: string,
    onChunk?: (chunk: StreamChunk & { sessionId: string }) => void
  ): Promise<APIResponse<{ sessionId: string }>> => {
    console.log('[Preload] chatStream called:', { message, conversationId });

    return new Promise((resolve, reject) => {
      // 🔧 修复竞态条件：在 invoke 前注册全局监听器
      let sessionId: string | null = null;
      let chunkHandler: ((event: Electron.IpcRendererEvent, data: StreamChunk & { sessionId: string }) => void) | null = null;

      chunkHandler = (_event: Electron.IpcRendererEvent, data: StreamChunk & { sessionId: string }) => {
        console.log('[Preload] Chunk received:', data);

        // 只处理匹配的 sessionId
        if (sessionId && data.sessionId === sessionId && onChunk) {
          onChunk(data);

          // 流结束时清理监听器
          if (data.type === 'end' || data.type === 'error') {
            console.log('[Preload] Removing chunk handler');
            if (chunkHandler) {
              ipcRenderer.removeListener(IPC_CHANNELS.AI.CHAT_STREAM_CHUNK, chunkHandler);
            }
          }
        }
      };

      // 先注册监听器
      ipcRenderer.on(IPC_CHANNELS.AI.CHAT_STREAM_CHUNK, chunkHandler);
      console.log('[Preload] Chunk handler registered (before invoke)');

      // 再启动流
      ipcRenderer.invoke(IPC_CHANNELS.AI.CHAT_STREAM, { message, conversationId })
        .then((response: APIResponse<{ sessionId: string }>) => {
          console.log('[Preload] CHAT_STREAM response:', response);

          if (!response.success) {
            console.error('[Preload] CHAT_STREAM failed:', response.error);
            // 清理监听器
            if (chunkHandler) {
              ipcRenderer.removeListener(IPC_CHANNELS.AI.CHAT_STREAM_CHUNK, chunkHandler);
            }
            reject(new Error(response.error || "Failed to start stream"));
            return;
          }

          // 设置 sessionId，开始接收 chunk
          sessionId = response.data!.sessionId;
          console.log('[Preload] Session ID:', sessionId);

          resolve({ success: true, data: { sessionId } });
        })
        .catch((error) => {
          console.error('[Preload] chatStream error:', error);
          // 清理监听器
          if (chunkHandler) {
            ipcRenderer.removeListener(IPC_CHANNELS.AI.CHAT_STREAM_CHUNK, chunkHandler);
          }
          reject(error);
        });
    });
  },

  // 中止流式聊天
  abortChat: (sessionId: string): Promise<APIResponse<{ aborted: boolean }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI.CHAT_ABORT, sessionId),

  getSafeSettings: (): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI.GET_SAFE_SETTINGS),

  setSettings: (settings: unknown): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI.SET_SETTINGS, settings),

  testConnection: (config: unknown): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI.TEST_CONNECTION, config),

  getChatHistory: (conversationId: string): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI.GET_CHAT_HISTORY, conversationId),

  clearChatHistory: (conversationId: string): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI.CLEAR_CHAT_HISTORY, conversationId),

  searchSemantic: (query: string, filters?: { language?: string; topics?: string[] }): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI.SEARCH_SEMANTIC, query, filters),

  generateEmbedding: (text: string): Promise<APIResponse<number[]>> =>
    ipcRenderer.invoke(IPC_CHANNELS.AI.GENERATE_EMBEDDING, text),
};

// Shell API - 用于打开外部链接
const shellAPI = {
  openExternal: (url: string): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL.OPEN_EXTERNAL, url),
  openPath: (path: string): Promise<APIResponse<string>> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL.OPEN_PATH, path),
  showItemInFolder: (fullPath: string): Promise<APIResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.SHELL.SHOW_ITEM_IN_FOLDER, fullPath),
};

// 通用的IPC调用方法（用于新的认证API）
const invoke = (channel: string, ...args: unknown[]) => {
  return ipcRenderer.invoke(channel, ...args);
};

// 合并所有 API
const electronAPI = {
  window: windowAPI,
  theme: themeAPI,
  language: languageAPI,
  settings: settingsAPI,
  search: searchAPI,
  github: githubAPI,
  database: databaseAPI,
  ai: aiAPI,
  secureStorage: secureStorageAPI,
  shell: shellAPI,
  // 添加通用invoke方法以支持新的IPC通道
  invoke,
};

// 将 API 暴露给渲染进程
contextBridge.exposeInMainWorld("electronAPI", electronAPI);

// 导出类型定义供 TypeScript 使用
export type ElectronAPI = typeof electronAPI;
