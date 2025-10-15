import { ipcMain } from "electron";
import { WindowManager } from "../../window";
import { IPC_CHANNELS } from "../../../shared/constants/ipc-channels";
import { setupSecureStorageHandlers } from "../secure-storage-handler";
import { setupShellHandlers } from "./shell-handler";
import { registerGitHubHandlers } from "../github-handlers";
import { registerAuthIPCHandlers } from "../auth-ipc-handlers";
import { settingsService } from "../../services/settings";
import { lancedbService } from "../../services/database/lancedb-service";
import { githubStarService } from "../../services/github";
import type { ThemeMode, Language, AppSettings } from "../../../shared/types/index.js";
import { getLogger } from "../../utils/logger";
// 导入搜索处理器
import "../search-handlers";

const themeLogger = getLogger('ipc:theme');
const languageLogger = getLogger('ipc:language');
const settingsLogger = getLogger('ipc:settings');

/**
 * 注册所有 IPC 处理器
 */
export function registerIpcHandlers(): void {
  registerWindowHandlers();
  registerThemeHandlers();
  registerLanguageHandlers();
  registerSettingsHandlers();
  setupSecureStorageHandlers();
  setupShellHandlers();
  registerGitHubHandlers();
  registerAuthIPCHandlers(); // 新的认证IPC处理器
  registerDatabaseHandlers(); // 数据库处理器
  registerAIHandlers(); // AI处理器
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
      // 转换为使用正确的类型转换
      const result = await lancedbService.searchRepositories(query, {
        limit: options?.limit,
        offset: options?.offset,
        query: query,
      });
      return { success: true, data: result };
    } catch (error) {
      dbLogger.error('数据库搜索失败', error);
      return { success: false, error: error instanceof Error ? error.message : '搜索失败' };
    }
  });

  // 存储仓库
  ipcMain.handle(IPC_CHANNELS.DATABASE.STORE_REPO, async (_, repo: import('@shared/types').GitHubRepository) => {
    try {
      await lancedbService.storeRepository(repo);
      return { success: true };
    } catch (error) {
      dbLogger.error('仓库存储失败', error);
      return { success: false, error: error instanceof Error ? error.message : '存储失败' };
    }
  });

  // 获取仓库列表
  ipcMain.handle(IPC_CHANNELS.DATABASE.GET_REPOS, async (_, options?: { limit?: number; offset?: number; language?: string }) => {
    try {
      const result = await lancedbService.getRepositories(options);
      return { success: true, data: result };
    } catch (error) {
      dbLogger.error('获取仓库列表失败', error);
      return { success: false, error: error instanceof Error ? error.message : '获取失败' };
    }
  });

  // 删除仓库
  ipcMain.handle(IPC_CHANNELS.DATABASE.DELETE_REPO, async (_, repoId: number) => {
    try {
      await lancedbService.deleteRepository(repoId);
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
function registerAIHandlers(): void {
  const aiLogger = getLogger('ipc:ai');

  // AI 聊天
  ipcMain.handle(IPC_CHANNELS.AI.CHAT, async (_, message: string, conversationId?: string) => {
    try {
      // 占位符实现 - 未来可以集成真正的 AI 服务
      const response = { 
        reply: `AI 响应: "${message}" (功能待实现)`,
        conversationId: conversationId || 'default'
      };
      return { success: true, data: response };
    } catch (error) {
      aiLogger.error('AI聊天失败', error);
      return { success: false, error: error instanceof Error ? error.message : '聊天失败' };
    }
  });

  // 语义搜索
  ipcMain.handle(IPC_CHANNELS.AI.SEARCH_SEMANTIC, async (_, query: string, filters?: { language?: string; topics?: string[] }) => {
    try {
      // 占位符实现 - 未来可以集成真正的嵌入式搜索
      const response = { 
        results: [],
        query,
        filters,
        message: '语义搜索功能待实现'
      };
      return { success: true, data: response };
    } catch (error) {
      aiLogger.error('语义搜索失败', error);
      return { success: false, error: error instanceof Error ? error.message : '搜索失败' };
    }
  });

  // 生成嵌入向量
  ipcMain.handle(IPC_CHANNELS.AI.GENERATE_EMBEDDING, async (_event, _text: string) => {
    try {
      // 占位符实现 - 未来可以集成真正的嵌入模型
      const mockEmbedding = Array.from({ length: 1536 }, () => Math.random() - 0.5); // 模拟 OpenAI 嵌入向量
      return { success: true, data: mockEmbedding };
    } catch (error) {
      aiLogger.error('生成嵌入向量失败', error);
      return { success: false, error: error instanceof Error ? error.message : '生成失败' };
    }
  });
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
 * 主题相关的 IPC 处理器
 */
function registerThemeHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.THEME.GET_THEME, async () => {
    try {
      const theme = await settingsService.getTheme();
      return { success: true, data: theme };
    } catch (error) {
      themeLogger.error("获取主题失败", error);
      return { success: false, error: "获取主题失败" };
    }
  });

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
      themeLogger.error("设置主题失败", error);
      return { success: false, error: "设置主题失败" };
    }
  });

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
      themeLogger.error("切换主题失败", error);
      return { success: false, error: "切换主题失败" };
    }
  });
}

/**
 * 语言相关的 IPC 处理器
 */
function registerLanguageHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.LANGUAGE.GET_LANGUAGE, async () => {
    try {
      const language = await settingsService.getLanguage();
      return { success: true, data: language };
    } catch (error) {
      languageLogger.error("获取语言失败", error);
      return { success: false, error: "获取语言失败" };
    }
  });

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
        languageLogger.error("设置语言失败", error);
        return { success: false, error: "设置语言失败" };
      }
    },
  );
}

/**
 * 应用设置相关的 IPC 处理器
 */
function registerSettingsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET_SETTINGS, async () => {
    try {
      const settings = await settingsService.getSettings();
      return { success: true, data: settings };
    } catch (error) {
      settingsLogger.error("获取应用设置失败", error);
      return { success: false, error: "获取应用设置失败" };
    }
  });

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

  ipcMain.handle(IPC_CHANNELS.SETTINGS.CLEAR_CACHE, async () => {
    try {
      await githubStarService.clearCache();
      return { success: true };
    } catch (error) {
      settingsLogger.error("清理缓存失败", error);
      return { success: false, error: "清理缓存失败" };
    }
  });
}
