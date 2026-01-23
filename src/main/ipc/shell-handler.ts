import { ipcMain, shell, app } from "electron";
import * as path from "path";
import type { APIResponse } from "@shared/types";
import { IPC_CHANNELS } from "@shared/constants/ipc-channels";
import { getLogger } from "../utils/logger";

const shellLogger = getLogger("ipc:shell");

/**
 * Shell IPC 处理器
 * 提供安全的外部链接和文件系统操作
 */

/**
 * 获取允许访问的路径白名单
 */
function getAllowedPaths(): string[] {
  return [
    app.getPath('userData'),      // ~/.starepo/ (应用数据目录)
    app.getPath('downloads'),      // 下载目录
    app.getPath('documents'),      // 文档目录
    app.getPath('desktop'),        // 桌面
    app.getPath('temp'),           // 临时目录
  ];
}

/**
 * 检查路径是否在白名单中
 */
function isPathAllowed(targetPath: string): boolean {
  const normalizedPath = path.normalize(targetPath);
  const allowedPaths = getAllowedPaths();

  // 检查路径是否在任何允许的目录下
  return allowedPaths.some(allowedPath => {
    const normalizedAllowed = path.normalize(allowedPath);
    return normalizedPath.startsWith(normalizedAllowed);
  });
}

export function registerShellHandlers(): void {
  // 打开外部链接
  ipcMain.handle(IPC_CHANNELS.SHELL.OPEN_EXTERNAL, async (_, url: string): Promise<APIResponse> => {
    try {
      // 验证 URL 格式
      const urlObj = new URL(url);
      
      // 只允许 HTTP(S) 和一些安全的协议
      const allowedProtocols = ['http:', 'https:', 'mailto:'];
      if (!allowedProtocols.includes(urlObj.protocol)) {
        return {
          success: false,
          error: `不允许的协议: ${urlObj.protocol}`,
        };
      }

      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      shellLogger.error("打开外部链接失败", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "打开链接失败",
      };
    }
  });

  // 打开文件路径
  ipcMain.handle(IPC_CHANNELS.SHELL.OPEN_PATH, async (_, targetPath: string): Promise<APIResponse<string>> => {
    try {
      // 安全检查：路径白名单
      if (!isPathAllowed(targetPath)) {
        shellLogger.warn("尝试打开白名单外的路径", { path: targetPath });
        return {
          success: false,
          error: "出于安全考虑，无法打开该路径。只允许访问应用数据、下载、文档、桌面和临时目录。",
        };
      }

      const result = await shell.openPath(targetPath);
      return { success: true, data: result };
    } catch (error) {
      shellLogger.error("打开路径失败", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "打开路径失败",
      };
    }
  });

  // 在文件夹中显示文件
  ipcMain.handle(IPC_CHANNELS.SHELL.SHOW_ITEM_IN_FOLDER, async (_, fullPath: string): Promise<APIResponse> => {
    try {
      // 安全检查：路径白名单
      if (!isPathAllowed(fullPath)) {
        shellLogger.warn("尝试显示白名单外的文件", { path: fullPath });
        return {
          success: false,
          error: "出于安全考虑，无法显示该文件。只允许访问应用数据、下载、文档、桌面和临时目录。",
        };
      }

      shell.showItemInFolder(fullPath);
      return { success: true };
    } catch (error) {
      shellLogger.error("显示文件失败", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "显示文件失败",
      };
    }
  });

  shellLogger.debug("Shell IPC 处理器已设置");
}

