import { ipcMain, shell } from "electron";
import type { APIResponse } from "@shared/types";
import { getLogger } from "../../utils/logger";

const shellLogger = getLogger("ipc:shell");

/**
 * Shell IPC 处理器
 * 提供安全的外部链接和文件系统操作
 */

export function setupShellHandlers(): void {
  // 打开外部链接
  ipcMain.handle("shell:openExternal", async (_, url: string): Promise<APIResponse> => {
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
  ipcMain.handle("shell:openPath", async (_, path: string): Promise<APIResponse<string>> => {
    try {
      const result = await shell.openPath(path);
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
  ipcMain.handle("shell:showItemInFolder", async (_, fullPath: string): Promise<APIResponse> => {
    try {
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

  shellLogger.info("Shell IPC 处理器已设置");
}
