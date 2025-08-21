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

  // GitHub 集成 (未来功能)
  GITHUB: {
    AUTHENTICATE: "github:authenticate",
    GET_STARS: "github:getStars",
    GET_USER: "github:getUser",
    SYNC_STARS: "github:syncStars",
  },

  // 数据库操作 (未来功能)
  DATABASE: {
    SEARCH: "database:search",
    STORE_REPO: "database:storeRepo",
    GET_REPOS: "database:getRepos",
    DELETE_REPO: "database:deleteRepo",
  },

  // AI 服务 (未来功能)
  AI: {
    CHAT: "ai:chat",
    SEARCH_SEMANTIC: "ai:searchSemantic",
    GENERATE_EMBEDDING: "ai:generateEmbedding",
  },

  // 应用设置
  SETTINGS: {
    GET_SETTINGS: "settings:getSettings",
    SET_SETTING: "settings:setSetting",
    RESET_SETTINGS: "settings:resetSettings",
  },
} as const;

// 提取所有通道名称的类型
export type IPCChannelName =
  | (typeof IPC_CHANNELS.WINDOW)[keyof typeof IPC_CHANNELS.WINDOW]
  | (typeof IPC_CHANNELS.THEME)[keyof typeof IPC_CHANNELS.THEME]
  | (typeof IPC_CHANNELS.LANGUAGE)[keyof typeof IPC_CHANNELS.LANGUAGE]
  | (typeof IPC_CHANNELS.GITHUB)[keyof typeof IPC_CHANNELS.GITHUB]
  | (typeof IPC_CHANNELS.DATABASE)[keyof typeof IPC_CHANNELS.DATABASE]
  | (typeof IPC_CHANNELS.AI)[keyof typeof IPC_CHANNELS.AI]
  | (typeof IPC_CHANNELS.SETTINGS)[keyof typeof IPC_CHANNELS.SETTINGS];
