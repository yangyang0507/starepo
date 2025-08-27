import { ipcMain } from "electron";
import { WindowManager } from "../../window";
import { IPC_CHANNELS } from "../../../shared/constants/ipc-channels";
import { setupSecureStorageHandlers } from "../secure-storage-handler";
import { setupShellHandlers } from "./shell-handler";

/**
 * 注册所有 IPC 处理器
 */
export function registerIpcHandlers(): void {
  registerWindowHandlers();
  registerThemeHandlers();
  registerLanguageHandlers();
  setupSecureStorageHandlers();
  setupShellHandlers();
  // 未来可以在这里添加更多处理器
  // registerGitHubHandlers();
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
 * TODO: 实现主题持久化存储
 */
function registerThemeHandlers(): void {
  let currentTheme: string = "system";

  ipcMain.handle(IPC_CHANNELS.THEME.GET_THEME, () => {
    return { success: true, data: currentTheme };
  });

  ipcMain.handle(IPC_CHANNELS.THEME.SET_THEME, (_event, theme: string) => {
    currentTheme = theme;

    // 向所有渲染进程广播主题变更
    const windowManager = WindowManager.getInstance();
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.THEME.THEME_CHANGED, theme);
    }

    return { success: true, data: theme };
  });

  ipcMain.handle(IPC_CHANNELS.THEME.TOGGLE_THEME, () => {
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    currentTheme = newTheme;

    // 向所有渲染进程广播主题变更
    const windowManager = WindowManager.getInstance();
    const mainWindow = windowManager.getMainWindow();
    if (mainWindow) {
      mainWindow.webContents.send(IPC_CHANNELS.THEME.THEME_CHANGED, newTheme);
    }

    return { success: true, data: newTheme };
  });
}

/**
 * 语言相关的 IPC 处理器
 * TODO: 实现语言持久化存储
 */
function registerLanguageHandlers(): void {
  let currentLanguage: string = "en";

  ipcMain.handle(IPC_CHANNELS.LANGUAGE.GET_LANGUAGE, () => {
    return { success: true, data: currentLanguage };
  });

  ipcMain.handle(
    IPC_CHANNELS.LANGUAGE.SET_LANGUAGE,
    (_event, language: string) => {
      currentLanguage = language;

      // 向所有渲染进程广播语言变更
      const windowManager = WindowManager.getInstance();
      const mainWindow = windowManager.getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send(
          IPC_CHANNELS.LANGUAGE.LANGUAGE_CHANGED,
          language,
        );
      }

      return { success: true, data: language };
    },
  );
}
