import { ipcMain, shell } from "electron";
import type { APIResponse } from "@shared/types";
import { IPC_CHANNELS } from "@shared/constants/ipc-channels";
import { getLogger } from "../utils/logger";

const shellLogger = getLogger("ipc:shell");

/**
 * Shell IPC 处理器
 * 提供安全的外部链接和文件系统操作
 */

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
  ipcMain.handle(IPC_CHANNELS.SHELL.OPEN_PATH, async (_, path: string): Promise<APIResponse<string>> => {
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
  ipcMain.handle(IPC_CHANNELS.SHELL.SHOW_ITEM_IN_FOLDER, async (_, fullPath: string): Promise<APIResponse> => {
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

  shellLogger.debug("Shell IPC 处理器已设置");
}

