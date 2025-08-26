import { BrowserWindow } from "electron";
import path from "path";

// Vite 插件注入的全局变量
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

export class WindowManager {
  private static instance: WindowManager;
  private mainWindow: BrowserWindow | null = null;

  private constructor() {}

  public static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager();
    }
    return WindowManager.instance;
  }

  public async createMainWindow(): Promise<BrowserWindow> {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.focus();
      return this.mainWindow;
    }

    const isDevelopment = process.env.NODE_ENV === "development";
    // 使用正确的预加载脚本路径
    const preloadPath = path.join(__dirname, "preload.js");

    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        devTools: isDevelopment,
        contextIsolation: true,
        nodeIntegration: false,
        nodeIntegrationInSubFrames: false,
        preload: preloadPath,
      },
      titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
      show: false, // 窗口创建后不立即显示，等加载完成后再显示
    });

    // 窗口加载完成后显示
    this.mainWindow.once("ready-to-show", () => {
      this.mainWindow?.show();

      if (isDevelopment) {
        this.mainWindow?.webContents.openDevTools();
      }
    });

    // 窗口关闭时清理引用
    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });

    // 加载应用内容
    await this.loadMainWindow();

    return this.mainWindow;
  }

  private async loadMainWindow(): Promise<void> {
    if (!this.mainWindow) return;

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      // 开发模式：从 Vite 开发服务器加载
      await this.mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      // 生产模式：从构建文件加载
      const htmlPath = path.join(
        __dirname,
        `../../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
      );
      await this.mainWindow.loadFile(htmlPath);
    }
  }

  public getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  public hasMainWindow(): boolean {
    return this.mainWindow !== null && !this.mainWindow.isDestroyed();
  }

  public focusMainWindow(): void {
    if (this.hasMainWindow()) {
      this.mainWindow?.focus();
    }
  }

  public closeMainWindow(): void {
    if (this.hasMainWindow()) {
      this.mainWindow?.close();
    }
  }
}
