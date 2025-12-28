import { app } from "electron";
import { WindowManager } from "./window";
import { registerIpcHandlers } from "./ipc";
import { installExtensions } from "./utils/dev-tools";
import { enhancedGitHubAuthService } from "./services/github/enhanced-auth-service";
import { modelDiscoveryService } from "./services/ai/discovery/model-discovery-service";
import { getLogger } from "./utils/logger";

const isDevelopment = process.env.NODE_ENV === "development";
const appLogger = getLogger("app:main");

// 设置应用名称
app.setName("Starepo");

async function createApplication(): Promise<void> {
  // 初始化认证服务，尝试从存储恢复认证状态
  try {
    await enhancedGitHubAuthService.initialize();
    appLogger.debug("认证服务初始化完成");
  } catch (error) {
    appLogger.warn("认证服务初始化失败，但不影响应用启动", error);
  }

  // 初始化 AI 模型发现服务
  try {
    await modelDiscoveryService.initialize();
    appLogger.debug("AI 模型发现服务初始化完成");
  } catch (error) {
    appLogger.warn("AI 模型发现服务初始化失败，但不影响应用启动", error);
  }

  // 注册 IPC 处理器
  await registerIpcHandlers();

  // 创建主窗口
  const windowManager = WindowManager.getInstance();
  await windowManager.createMainWindow();

  // 开发环境下安装扩展
  if (isDevelopment) {
    await installExtensions();
  }
}

// 应用准备就绪时创建窗口
app.whenReady().then(createApplication);

// macOS 特有行为：所有窗口关闭时不退出应用
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// macOS 特有行为：dock 图标被点击时重新创建窗口
app.on("activate", async () => {
  const windowManager = WindowManager.getInstance();
  if (!windowManager.hasMainWindow()) {
    await windowManager.createMainWindow();
  }
});

// 应用退出前的清理工作
app.on("before-quit", () => {
  // 这里可以添加清理逻辑，如保存设置、关闭数据库连接等
  appLogger.info("Application is quitting...");
});
