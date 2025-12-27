import { ipcMain } from "electron";
import { WindowManager } from "../window";
import { IPC_CHANNELS } from "../../shared/constants/ipc-channels";
import { registerSecureStorageHandlers } from "./secure-storage-handler";
import { registerShellHandlers } from "./shell-handler";
import { registerGitHubHandlers } from "./github-handlers";
import { registerAuthIPCHandlers } from "./auth-ipc-handlers";
import { settingsService } from "../services/settings";
import { lancedbService } from "../services/database/lancedb-service";
import { githubStarService } from "../services/github";
import type { ThemeMode, Language, AppSettings } from "../../shared/types/index.js";
import { getLogger } from "../utils/logger";
// 导入搜索处理器
import "./search-handlers";
// 导入 AI 处理器
import { initializeAIHandlers, setAIService } from "./ai-handlers";
import { AIService, aiSettingsService } from "../services/ai";

const settingsLogger = getLogger('ipc:settings');

/**
 * 注册所有 IPC 处理器
 */
export function registerIpcHandlers(): void {
  registerWindowHandlers();
  registerSettingsHandlers();
  registerSecureStorageHandlers();
  registerShellHandlers();
  registerGitHubHandlers();
  registerAuthIPCHandlers();
  registerDatabaseHandlers();
  registerAIHandlers();
  // registerPerformanceHandlers(); // 性能监控处理器 - 暂时禁用
}

/**
 * 数据库相关的 IPC 处理器
 */
function registerDatabaseHandlers(): void {
  const dbLogger = getLogger('ipc:database');

  // 搜索仓库
  ipcMain.handle(IPC_CHANNELS.DATABASE.SEARCH, async (_, query: string, options?: { limit?: number; offset?: number }) => {
    try {
      // searchRepositories 方法签名: (query: string, limit?: number, where?: string)
      const result = await lancedbService.searchRepositories(
        query,
        options?.limit || 10
      );
      return { success: true, data: result };
    } catch (error) {
      dbLogger.error('数据库搜索失败', error);
      return { success: false, error: error instanceof Error ? error.message : '搜索失败' };
    }
  });

  // 存储仓库
  ipcMain.handle(IPC_CHANNELS.DATABASE.STORE_REPO, async (_, repo: import('@shared/types').GitHubRepository) => {
    try {
      // upsertRepositories 方法接受数组参数
      await lancedbService.upsertRepositories([repo]);
      return { success: true };
    } catch (error) {
      dbLogger.error('仓库存储失败', error);
      return { success: false, error: error instanceof Error ? error.message : '存储失败' };
    }
  });

  // 获取仓库列表
  ipcMain.handle(IPC_CHANNELS.DATABASE.GET_REPOS, async (_, options?: { limit?: number; offset?: number; language?: string }) => {
    try {
      let result;
      if (options?.language) {
        // 如果指定了语言，使用 getRepositoriesByLanguage
        result = await lancedbService.getRepositoriesByLanguage(options.language, options.limit);
      } else {
        // 否则使用 getAllRepositories
        result = await lancedbService.getAllRepositories(options?.limit, options?.offset);
      }
      return { success: true, data: result };
    } catch (error) {
      dbLogger.error('获取仓库列表失败', error);
      return { success: false, error: error instanceof Error ? error.message : '获取失败' };
    }
  });

  // 删除仓库
  ipcMain.handle(IPC_CHANNELS.DATABASE.DELETE_REPO, async (_, repoId: number) => {
    try {
      // deleteRepositories 方法接受 ID 数组参数
      await lancedbService.deleteRepositories([repoId]);
      return { success: true };
    } catch (error) {
      dbLogger.error('删除仓库失败', error);
      return { success: false, error: error instanceof Error ? error.message : '删除失败' };
    }
  });
}

/**
 * AI 相关的 IPC 处理器
 */
async function registerAIHandlers(): Promise<void> {
  const aiLogger = getLogger('ipc:ai');

  try {
    // 创建 AI 服务实例
    const aiService = new AIService();

    // 加载并使用保存的设置进行初始化
    const settings = await aiSettingsService.getSettings();
    if (settings && settings.enabled) {
      try {
        await aiService.initialize(settings);
        aiLogger.debug('AI 服务已使用保存的设置初始化');
      } catch (initError) {
        aiLogger.error('AI 服务初始化失败:', initError);
      }
    }

    // 设置 AI 服务实例
    setAIService(aiService);

    // 初始化 IPC 处理器
    initializeAIHandlers();

    aiLogger.debug('AI IPC 处理器已成功注册');
  } catch (error) {
    aiLogger.error('AI IPC 处理器初始化失败:', error);
  }
}

/**
 * 窗口管理相关的 IPC 处理器
 */
function registerWindowHandlers(): void {
  const windowManager = WindowManager.getInstance();

  ipcMain.handle(IPC_CHANNELS.WINDOW.MINIMIZE, () => {
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow) {
      mainWindow.minimize();
      return { success: true };
    }
    return { success: false, error: "No main window found" };
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW.MAXIMIZE, () => {
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow) {
      mainWindow.maximize();
      return { success: true };
    }
    return { success: false, error: "No main window found" };
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW.CLOSE, () => {
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow) {
      mainWindow.close();
      return { success: true };
    }
    return { success: false, error: "No main window found" };
  });

  ipcMain.handle(IPC_CHANNELS.WINDOW.TOGGLE_MAXIMIZE, () => {
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      return { success: true, isMaximized: mainWindow.isMaximized() };
    }
    return { success: false, error: "No main window found" };
  });

  ipcMain.handle(
    IPC_CHANNELS.WINDOW.SET_FULLSCREEN,
    (_event, fullscreen: boolean) => {
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow) {
        mainWindow.setFullScreen(fullscreen);
        return { success: true, isFullscreen: mainWindow.isFullScreen() };
      }
      return { success: false, error: "No main window found" };
    },
  );
}

/**
 * 应用设置相关的 IPC 处理器
 * 包括：通用设置、主题、语言
 */
function registerSettingsHandlers(): void {
  // 获取应用设置
  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET_SETTINGS, async () => {
    try {
      const settings = await settingsService.getSettings();
      return { success: true, data: settings };
    } catch (error) {
      settingsLogger.error("获取应用设置失败", error);
      return { success: false, error: "获取应用设置失败" };
    }
  });

  // 更新应用设置
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS.SET_SETTING,
    async (_event, update: Partial<AppSettings>) => {
      try {
        const normalizedUpdate = update ?? {};
        const updated = await settingsService.updateSettings(normalizedUpdate);

        if (Object.prototype.hasOwnProperty.call(normalizedUpdate, "developerMode")) {
          const windowManager = WindowManager.getInstance();
          const mainWindow = windowManager.getMainWindow();
          if (mainWindow) {
            if (updated.developerMode) {
              mainWindow.webContents.openDevTools({ mode: "detach" });
            } else if (mainWindow.webContents.isDevToolsOpened()) {
              mainWindow.webContents.closeDevTools();
            }
          }
        }

        return { success: true, data: updated };
      } catch (error) {
        settingsLogger.error("更新应用设置失败", error);
        return { success: false, error: "更新应用设置失败" };
      }
    },
  );

  // 重置设置
  ipcMain.handle(IPC_CHANNELS.SETTINGS.RESET_SETTINGS, async () => {
    try {
      await settingsService.reset();
      const settings = await settingsService.getSettings();
      return { success: true, data: settings };
    } catch (error) {
      settingsLogger.error("重置应用设置失败", error);
      return { success: false, error: "重置应用设置失败" };
    }
  });

  // 清理缓存
  ipcMain.handle(IPC_CHANNELS.SETTINGS.CLEAR_CACHE, async () => {
    try {
      await githubStarService.clearCache();
      return { success: true };
    } catch (error) {
      settingsLogger.error("清理缓存失败", error);
      return { success: false, error: "清理缓存失败" };
    }
  });

  // === 主题管理 ===

  // 获取主题
  ipcMain.handle(IPC_CHANNELS.THEME.GET_THEME, async () => {
    try {
      const theme = await settingsService.getTheme();
      return { success: true, data: theme };
    } catch (error) {
      settingsLogger.error("获取主题失败", error);
      return { success: false, error: "获取主题失败" };
    }
  });

  // 设置主题
  ipcMain.handle(IPC_CHANNELS.THEME.SET_THEME, async (_event, theme: string) => {
    try {
      const updatedTheme = await settingsService.setTheme(theme as ThemeMode);

      const windowManager = WindowManager.getInstance();
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send(IPC_CHANNELS.THEME.THEME_CHANGED, updatedTheme);
      }

      return { success: true, data: updatedTheme };
    } catch (error) {
      settingsLogger.error("设置主题失败", error);
      return { success: false, error: "设置主题失败" };
    }
  });

  // 切换主题
  ipcMain.handle(IPC_CHANNELS.THEME.TOGGLE_THEME, async () => {
    try {
      const currentTheme = await settingsService.getTheme();
      const nextTheme: ThemeMode = currentTheme === "dark" ? "light" : "dark";
      const savedTheme = await settingsService.setTheme(nextTheme);

      const windowManager = WindowManager.getInstance();
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send(IPC_CHANNELS.THEME.THEME_CHANGED, savedTheme);
      }

      return { success: true, data: savedTheme };
    } catch (error) {
      settingsLogger.error("切换主题失败", error);
      return { success: false, error: "切换主题失败" };
    }
  });

  // === 语言管理 ===

  // 获取语言
  ipcMain.handle(IPC_CHANNELS.LANGUAGE.GET_LANGUAGE, async () => {
    try {
      const language = await settingsService.getLanguage();
      return { success: true, data: language };
    } catch (error) {
      settingsLogger.error("获取语言失败", error);
      return { success: false, error: "获取语言失败" };
    }
  });

  // 设置语言
  ipcMain.handle(
    IPC_CHANNELS.LANGUAGE.SET_LANGUAGE,
    async (_event, language: string) => {
      try {
        const updatedLanguage = await settingsService.setLanguage(language as Language);

        const windowManager = WindowManager.getInstance();
        const mainWindow = windowManager.getMainWindow();
        if (mainWindow) {
          mainWindow.webContents.send(
            IPC_CHANNELS.LANGUAGE.LANGUAGE_CHANGED,
            updatedLanguage,
          );
        }

        return { success: true, data: updatedLanguage };
      } catch (error) {
        settingsLogger.error("设置语言失败", error);
        return { success: false, error: "设置语言失败" };
      }
    },
  );
}

