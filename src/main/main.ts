import { app } from "electron";
import { WindowManager } from "./window";
import { registerIpcHandlers } from "./ipc/handlers";
import { installExtensions } from "./utils/dev-tools";
import { enhancedGitHubAuthService } from "./services/github/enhanced-auth-service";

const isDevelopment = process.env.NODE_ENV === "development";

// 设置应用名称
app.setName("Starepo");

async function createApplication(): Promise<void> {
  // 初始化认证服务，尝试从存储恢复认证状态
  try {
    await enhancedGitHubAuthService.initialize();
    console.log("认证服务初始化完成");
  } catch (error) {
    console.warn("认证服务初始化失败，但不影响应用启动:", error);
  }

  // 注册 IPC 处理器
  registerIpcHandlers();

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
  console.log("Application is quitting...");
});
