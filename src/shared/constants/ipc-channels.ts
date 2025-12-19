/**
 * IPC 通道定义
 * 在主进程和渲染进程之间提供类型安全的通信
 */

export const IPC_CHANNELS = {
  // 窗口管理
  WINDOW: {
    MINIMIZE: "window:minimize",
    MAXIMIZE: "window:maximize",
    CLOSE: "window:close",
    TOGGLE_MAXIMIZE: "window:toggleMaximize",
    SET_FULLSCREEN: "window:setFullscreen",
  },

  // 主题管理
  THEME: {
    GET_THEME: "theme:getTheme",
    SET_THEME: "theme:setTheme",
    TOGGLE_THEME: "theme:toggleTheme",
    THEME_CHANGED: "theme:changed",
  },

  // 语言/本地化
  LANGUAGE: {
    GET_LANGUAGE: "language:getLanguage",
    SET_LANGUAGE: "language:setLanguage",
    LANGUAGE_CHANGED: "language:changed",
  },

  // 搜索功能
  SEARCH: {
    SEARCH_REPOSITORIES: "search:searchRepositories",
    GET_SEARCH_SUGGESTIONS: "search:getSearchSuggestions",
    GET_POPULAR_SEARCH_TERMS: "search:getPopularSearchTerms",
    GET_SEARCH_STATS: "search:getSearchStats",
  },

  // GitHub 集成
  GITHUB: {
    // 认证相关
    AUTHENTICATE_WITH_TOKEN: "github:authenticateWithToken",
    VALIDATE_TOKEN: "github:validateToken",
    GET_AUTH_STATE: "github:getAuthState",
    REFRESH_AUTH: "github:refreshAuth",
    CLEAR_AUTH: "github:clearAuth",

    // 用户相关
    GET_CURRENT_USER: "github:getCurrentUser",

    // Star 相关
    GET_STARRED_REPOSITORIES: "github:getStarredRepositories",
    GET_USER_STARRED_REPOSITORIES: "github:getUserStarredRepositories",
    CHECK_IF_STARRED: "github:checkIfStarred",
    STAR_REPOSITORY: "github:starRepository",
    UNSTAR_REPOSITORY: "github:unstarRepository",
    GET_ALL_STARRED_REPOSITORIES: "github:getAllStarredRepositories",
    GET_STARRED_STATS: "github:getStarredStats",
    SEARCH_STARRED_REPOSITORIES: "github:searchStarredRepositories",

    // 批量操作
    CHECK_MULTIPLE_STAR_STATUS: "github:checkMultipleStarStatus",
    STAR_MULTIPLE_REPOSITORIES: "github:starMultipleRepositories",
    UNSTAR_MULTIPLE_REPOSITORIES: "github:unstarMultipleRepositories",

    // 向量数据库集成
    INITIALIZE_DATABASE: "github:initializeDatabase",
    GET_ALL_STARRED_REPOSITORIES_ENHANCED: "github:getAllStarredRepositoriesEnhanced",
    SEARCH_REPOSITORIES_SEMANTICALLY: "github:searchRepositoriesSemanticially",
    GET_REPOSITORIES_BY_LANGUAGE_FROM_DB: "github:getRepositoriesByLanguageFromDatabase",
    GET_REPOSITORIES_BY_STAR_RANGE_FROM_DB: "github:getRepositoriesByStarRangeFromDatabase",
    GET_DATABASE_STATS: "github:getDatabaseStats",
    SYNC_REPOSITORIES_TO_DATABASE: "github:syncRepositoriesToDatabase",
  },

  // 数据库操作 (未来功能)
  DATABASE: {
    SEARCH: "database:search",
    STORE_REPO: "database:storeRepo",
    GET_REPOS: "database:getRepos",
    DELETE_REPO: "database:deleteRepo",
  },

  // AI 服务
  AI: {
    // 聊天相关
    CHAT: "ai:chat",
    GET_CHAT_HISTORY: "ai:getChatHistory",
    CLEAR_CHAT_HISTORY: "ai:clearChatHistory",

    // 设置相关
    GET_SETTINGS: "ai:getSettings",
    SET_SETTINGS: "ai:setSettings",
    GET_SAFE_SETTINGS: "ai:getSafeSettings",
    TEST_CONNECTION: "ai:testConnection",

    // Provider 和模型相关
    GET_PROVIDER_LIST: "ai:getProviderList",
    GET_MODEL_LIST: "ai:getModelList",
    CLEAR_MODEL_CACHE: "ai:clearModelCache",
    TEST_PROVIDER_CONNECTION: "ai:testProviderConnection",

    // Provider 账户管理
    SAVE_PROVIDER_ACCOUNT: "ai:saveProviderAccount",
    GET_PROVIDER_ACCOUNT: "ai:getProviderAccount",
    DELETE_PROVIDER_ACCOUNT: "ai:deleteProviderAccount",
    LIST_PROVIDER_ACCOUNTS: "ai:listProviderAccounts",

    // 统计相关
    GET_API_USAGE_STATS: "ai:getAPIUsageStats",
  },

  // 应用设置
  SETTINGS: {
    GET_SETTINGS: "settings:getSettings",
    SET_SETTING: "settings:setSetting",
    RESET_SETTINGS: "settings:resetSettings",
    CLEAR_CACHE: "settings:clearCache",
  },

  // 安全存储
  SECURE_STORAGE: {
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
  },

  // Shell 操作
  SHELL: {
    OPEN_EXTERNAL: "shell:openExternal",
    OPEN_PATH: "shell:openPath",
    SHOW_ITEM_IN_FOLDER: "shell:showItemInFolder",
  },
} as const;

// 提取所有通道名称的类型
export type IPCChannelName =
  | (typeof IPC_CHANNELS.WINDOW)[keyof typeof IPC_CHANNELS.WINDOW]
  | (typeof IPC_CHANNELS.THEME)[keyof typeof IPC_CHANNELS.THEME]
  | (typeof IPC_CHANNELS.LANGUAGE)[keyof typeof IPC_CHANNELS.LANGUAGE]
  | (typeof IPC_CHANNELS.SEARCH)[keyof typeof IPC_CHANNELS.SEARCH]
  | (typeof IPC_CHANNELS.GITHUB)[keyof typeof IPC_CHANNELS.GITHUB]
  | (typeof IPC_CHANNELS.DATABASE)[keyof typeof IPC_CHANNELS.DATABASE]
  | (typeof IPC_CHANNELS.AI)[keyof typeof IPC_CHANNELS.AI]
  | (typeof IPC_CHANNELS.SETTINGS)[keyof typeof IPC_CHANNELS.SETTINGS]
  | (typeof IPC_CHANNELS.SECURE_STORAGE)[keyof typeof IPC_CHANNELS.SECURE_STORAGE]
  | (typeof IPC_CHANNELS.SHELL)[keyof typeof IPC_CHANNELS.SHELL];

// 为了方便使用,也可以单独导出各个模块
export const WINDOW_CHANNELS = IPC_CHANNELS.WINDOW;
export const THEME_CHANNELS = IPC_CHANNELS.THEME;
export const LANGUAGE_CHANNELS = IPC_CHANNELS.LANGUAGE;
export const SEARCH_CHANNELS = IPC_CHANNELS.SEARCH;
export const GITHUB_CHANNELS = IPC_CHANNELS.GITHUB;
export const DATABASE_CHANNELS = IPC_CHANNELS.DATABASE;
export const AI_CHANNELS = IPC_CHANNELS.AI;
export const SETTINGS_CHANNELS = IPC_CHANNELS.SETTINGS;
export const SECURE_STORAGE_CHANNELS = IPC_CHANNELS.SECURE_STORAGE;
export const SHELL_CHANNELS = IPC_CHANNELS.SHELL;
