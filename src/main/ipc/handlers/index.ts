import { ipcMain } from "electron";
import { WindowManager } from "../../window";
import { IPC_CHANNELS } from "../../../shared/constants/ipc-channels";
import { setupSecureStorageHandlers } from "../secure-storage-handler";
import { setupShellHandlers } from "./shell-handler";
import { registerGitHubHandlers } from "../github-handlers";
import { registerAuthIPCHandlers } from "../auth-ipc-handlers";
import { settingsService } from "../../services/settings";
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
  // 未来可以在这里添加更多处理器
  // registerDatabaseHandlers();
  // registerAIHandlers();
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
}
